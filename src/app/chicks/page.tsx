'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { 
  ArrowPathIcon, 
  ArrowTrendingUpIcon, 
  BanknotesIcon, 
  BoltIcon, 
  CheckIcon,
  ChatBubbleLeftRightIcon,
  ClockIcon,
  CurrencyDollarIcon, 
  DocumentTextIcon,
  LockClosedIcon,
  PlayCircleIcon,
  QuestionMarkCircleIcon,
  ShieldCheckIcon, 
  SparklesIcon 
} from '@heroicons/react/24/outline';
import { Button, MotionButton } from '../components/ui/button';
import { Card, MotionCard, CardContent, CardTitle, CardDescription } from '../components/ui/card';
import ChicksStats from './components/ChicksStats';
import DistributionChart from './components/DistributionChart';
import FeatureCard from './components/FeatureCard';
import dynamic from 'next/dynamic';

// CSS variables for feature card colors
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

// Key features of CHICKS token
const chicksFeatures = [
  {
    title: '99% LTV Borrowing',
    description: 'Industry-leading 99% Loan-to-Value ratio allows you to borrow up to 99% against your CHICKS tokens, maximizing capital efficiency in DeFi.',
    icon: BanknotesIcon,
    color: 'from-blue-500 to-blue-700',
    highlight: true
  },
  {
    title: 'Leveraging',
    description: 'Use your borrowed funds to buy more CHICKS, creating powerful leverage positions with up to 100x potential through recursive borrowing.',
    icon: ArrowTrendingUpIcon,
    color: 'from-purple-500 to-indigo-600'
  },
  {
    title: 'Aave Yield Generation',
    description: 'CHICKS tokens are backed by USDC deposits in Aave, generating yield that helps maintain the token\'s value and stability over time.',
    icon: ArrowPathIcon,
    color: 'from-green-500 to-teal-600'
  },
  {
    title: 'Smart Liquidations',
    description: 'If your position falls below maintenance requirements, the protocol automatically liquidates just enough to restore health.',
    icon: ShieldCheckIcon,
    color: 'from-amber-500 to-orange-600'
  },
  {
    title: 'Flash Loans',
    description: 'Execute complex DeFi strategies with flash loans, allowing you to borrow without collateral for a single transaction.',
    icon: BoltIcon,
    color: 'from-pink-500 to-rose-600'
  },
  {
    title: '100% USDC Backing',
    description: 'Every CHICKS token is fully backed by USDC deposits, ensuring stability and transparency with no pre-minted tokens.',
    icon: LockClosedIcon,
    color: 'from-cyan-500 to-sky-600'
  }
];

export default function ChicksTokenPage() {
  interface FloatingElement {
    id: number;
    width: number;
    height: number;
    top: number;
    left: number;
  }
  
  interface ParticleElement {
    id: number;
    top: number;
    left: number;
    animationY: number;
    scale: number;
    duration: number;
    delay: number;
  }
  
  const [mounted, setMounted] = useState(false);
  const [floatingElements, setFloatingElements] = useState<FloatingElement[]>([]);
  const [particles, setParticles] = useState<ParticleElement[]>([]);
  
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"]
  });
  
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.5], [1, 0.8]);
  const y = useTransform(scrollYProgress, [0, 0.5], [0, 100]);
  
  // Floating elements animation
  const floatingAnimation = {
    y: [0, -10, 0],
    transition: {
      y: {
        repeat: Infinity,
        duration: 2,
        ease: "easeInOut"
      }
    }
  };

  // More complex floating animation for enhanced elements
  const enhancedFloatingAnimation = (delay: number) => ({
    y: [0, -15, 0],
    x: [0, 5, 0, -5, 0],
    rotate: [0, 5, 0, -5, 0],
    scale: [1, 1.05, 1],
    transition: {
      y: {
        repeat: Infinity,
        duration: 3 + delay,
        ease: "easeInOut" as const
      },
      x: {
        repeat: Infinity,
        duration: 4 + delay,
        ease: "easeInOut" as const
      },
      rotate: {
        repeat: Infinity,
        duration: 5 + delay,
        ease: "easeInOut" as const
      },
      scale: {
        repeat: Infinity,
        duration: 4 + delay,
        ease: "easeInOut" as const
      }
    }
  });
  
  useEffect(() => {
    setMounted(true);
    
    // Generate floating elements with fixed values to avoid hydration mismatches
    const generatedFloatingElements = Array(8).fill(0).map((_, i) => ({
      id: i,
      width: 40 + Math.random() * 60,
      height: 40 + Math.random() * 60,
      top: Math.random() * 100,
      left: Math.random() * 100
    }));
    setFloatingElements(generatedFloatingElements);
    
    // Generate particles for CTA section
    const generatedParticles = Array(20).fill(0).map((_, i) => ({
      id: i,
      top: Math.random() * 100,
      left: Math.random() * 100,
      animationY: Math.random() * -100,
      scale: Math.random() * 0.5 + 0.5,
      duration: 5 + Math.random() * 5,
      delay: Math.random() * 5
    }));
    setParticles(generatedParticles);
    
    // Add CSS variables to document
    const style = document.createElement('style');
    style.innerHTML = colorStyles;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Don't render anything with random values until after client-side hydration
  if (!mounted) {
    return <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
      {/* Loading state or simplified version that doesn't use random values */}
    </div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
      {/* Hero Section */}
      <div ref={heroRef} className="relative overflow-hidden bg-gradient-to-br from-btb-primary/10 via-btb-primary/5 to-transparent dark:from-btb-primary/20 dark:via-btb-primary/10 dark:to-transparent">
        {/* Animated gradient background */}
        <motion.div 
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            background: "linear-gradient(120deg, #4f46e5, #3b82f6, #06b6d4, #4f46e5)",
            backgroundSize: "400% 400%"
          }}
          animate={{
            backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"]
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "linear"
          }}
        />
        
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
              <p className="text-sm font-medium text-btb-primary">CHICKS Token</p>
            </motion.div>
            
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-btb-primary to-btb-primary-light bg-clip-text text-transparent"
            >
              The Most Capital Efficient Token in DeFi
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-lg mb-8 text-gray-600 dark:text-gray-300"
            >
              CHICKS is a 100% USDC-backed token that enables up to 99% LTV borrowing, leveraging, and yield generation through Aave.
            </motion.p>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-wrap justify-center gap-4"
            >
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Link href="/chicks/trade">
                  <Button 
                    size="lg" 
                    leftIcon={<CurrencyDollarIcon className="w-5 h-5" />}
                  >
                    Buy CHICKS
                  </Button>
                </Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button 
                  size="lg" 
                  variant="outline"
                  leftIcon={<ArrowPathIcon className="w-5 h-5" />}
                >
                  Learn More
                </Button>
              </motion.div>
            </motion.div>
          </div>
        </motion.div>
        
        {/* Enhanced floating elements */}
        <motion.div
          className="absolute top-20 left-[10%] w-12 h-12 rounded-full bg-blue-500/20 backdrop-blur-sm"
          animate={enhancedFloatingAnimation(0.2)}
        />
        <motion.div
          className="absolute top-40 right-[15%] w-16 h-16 rounded-full bg-purple-500/20 backdrop-blur-sm"
          animate={enhancedFloatingAnimation(0.5)}
        />
        <motion.div
          className="absolute bottom-20 left-[20%] w-10 h-10 rounded-full bg-green-500/20 backdrop-blur-sm"
          animate={enhancedFloatingAnimation(0.7)}
        />
        <motion.div
          className="absolute top-[30%] right-[25%] w-8 h-8 rounded-full bg-pink-500/20 backdrop-blur-sm"
          animate={enhancedFloatingAnimation(0.3)}
        />
        <motion.div
          className="absolute bottom-[30%] right-[10%] w-14 h-14 rounded-full bg-amber-500/20 backdrop-blur-sm"
          animate={enhancedFloatingAnimation(0.6)}
        />
        <motion.div
          className="absolute top-[60%] left-[30%] w-6 h-6 rounded-full bg-cyan-500/20 backdrop-blur-sm"
          animate={enhancedFloatingAnimation(0.4)}
        />
        
        {/* Floating icons */}
        <motion.div
          className="absolute top-[25%] left-[15%] text-blue-500/30"
          animate={enhancedFloatingAnimation(0.1)}
        >
          <BanknotesIcon className="w-10 h-10" />
        </motion.div>
        <motion.div
          className="absolute bottom-[35%] right-[20%] text-green-500/30"
          animate={enhancedFloatingAnimation(0.8)}
        >
          <ArrowTrendingUpIcon className="w-12 h-12" />
        </motion.div>
        <motion.div
          className="absolute top-[45%] right-[30%] text-purple-500/30"
          animate={enhancedFloatingAnimation(0.5)}
        >
          <SparklesIcon className="w-8 h-8" />
        </motion.div>
      </div>
      
      {/* Token Details Section */}
      <section className="py-16 bg-gray-50 dark:bg-gray-800 relative overflow-hidden">
        {/* Animated gradient background */}
        <motion.div 
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            background: "linear-gradient(45deg, rgba(79, 70, 229, 0.2), rgba(16, 185, 129, 0.2), rgba(79, 70, 229, 0.2))",
            backgroundSize: "200% 200%"
          }}
          animate={{
            backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"]
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "linear"
          }}
        />
        
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="mb-12 text-center"
          >
            <h2 className="text-3xl font-bold mb-4">Token Details</h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Everything you need to know about the CHICKS token
            </p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left side - Token info cards */}
            <div className="lg:col-span-7">
              <motion.div 
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
                variants={{
                  hidden: { opacity: 0 },
                  show: {
                    opacity: 1,
                    transition: {
                      staggerChildren: 0.1
                    }
                  }
                }}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
              >
                {[
                  {
                    icon: "🐣",
                    title: "Name",
                    value: "CHICKS Token",
                    color: "from-blue-500 to-indigo-600"
                  },
                  {
                    icon: "$",
                    title: "Symbol",
                    value: "CHICKS",
                    color: "from-purple-500 to-indigo-600"
                  },
                  {
                    icon: "🔗",
                    title: "Network",
                    value: "Base",
                    color: "from-cyan-500 to-blue-600"
                  },
                  {
                    icon: "∞",
                    title: "Max Supply",
                    value: "100,000,000,000 CHICKS",
                    color: "from-amber-500 to-orange-600"
                  },
                  {
                    icon: "💲",
                    title: "Initial Price",
                    value: "$0.0001",
                    color: "from-emerald-500 to-green-600"
                  },
                  {
                    icon: "💰",
                    title: "Backing",
                    value: "100% USDC",
                    color: "from-green-500 to-teal-600"
                  },
                  {
                    icon: "🔒",
                    title: "Security",
                    value: "Audited & Secured",
                    color: "from-rose-500 to-pink-600"
                  }
                ].map((item, index) => (
                  <motion.div
                    key={item.title}
                    variants={{
                      hidden: { opacity: 0, y: 20 },
                      show: { opacity: 1, y: 0 }
                    }}
                    whileHover={{ y: -5, transition: { duration: 0.2 } }}
                    className="h-full"
                  >
                    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm h-full overflow-hidden border border-gray-100 dark:border-gray-800">
                      <div className={`h-1.5 bg-gradient-to-r ${item.color}`}></div>
                      <div className="p-5">
                        <div className="flex items-center mb-3">
                          <motion.div 
                            className={`w-10 h-10 rounded-full bg-gradient-to-r ${item.color} flex items-center justify-center text-white mr-3`}
                            animate={{ scale: [1, 1.05, 1] }}
                            transition={{ duration: 3, repeat: Infinity }}
                          >
                            <span className="text-lg">{item.icon}</span>
                          </motion.div>
                          <div>
                            <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium">
                              {item.title}
                            </p>
                            <p className="font-bold text-gray-900 dark:text-white">
                              {item.value}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </div>

            {/* Right side - Distribution chart */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              viewport={{ once: true }}
              className="lg:col-span-5"
            >
              <div className="bg-white dark:bg-gray-900 p-8 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 h-full relative overflow-hidden">
                {/* Decorative elements */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-transparent rounded-bl-full pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-indigo-500/10 to-transparent rounded-tr-full pointer-events-none"></div>
                
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="mb-6 text-center"
                >
                  <h3 className="text-xl font-bold mb-2">Token Distribution</h3>
                  <div className="w-16 h-1 bg-gradient-to-r from-blue-500 to-cyan-400 mx-auto rounded-full"></div>
                </motion.div>
                
                <DistributionChart />
                
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="mt-6"
                >
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800/30">
                    <div className="flex items-start">
                      <div className="flex-shrink-0 mt-0.5">
                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-800/50 flex items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600 dark:text-blue-300" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300">100% USDC Backing</h4>
                        <p className="mt-1 text-xs text-blue-700 dark:text-blue-400">
                          CHICKS is fully backed by USDC deposits, with no pre-minted tokens or team allocations, ensuring maximum stability and transparency.
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
      
      {/* Key Features Section */}
      <section className="py-20 bg-white dark:bg-gray-900 relative overflow-hidden">
        {/* Animated background */}
        <motion.div 
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            background: "radial-gradient(circle at 20% 30%, rgba(79, 70, 229, 0.4), transparent 40%), radial-gradient(circle at 80% 70%, rgba(6, 182, 212, 0.4), transparent 40%)",
            backgroundSize: "200% 200%"
          }}
          animate={{
            backgroundPosition: ["0% 0%", "100% 100%"]
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "linear",
            repeatType: "reverse"
          }}
        />
        
        {/* Floating elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          {floatingElements.map((element) => (
            <motion.div
              key={element.id}
              className="absolute rounded-full bg-gradient-to-r from-btb-primary/20 to-blue-500/20 backdrop-blur-sm"
              style={{
                width: `${element.width}px`,
                height: `${element.height}px`,
                top: `${element.top}%`,
                left: `${element.left}%`,
              }}
              animate={enhancedFloatingAnimation(element.id * 0.5)}
            />
          ))}
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="mb-16 text-center"
          >
            <span className="inline-block px-3 py-1 bg-btb-primary/10 text-btb-primary text-sm font-medium rounded-full mb-3">
              POWERFUL FEATURES
            </span>
            <h2 className="text-4xl font-bold mb-6 bg-gradient-to-r from-btb-primary to-blue-600 bg-clip-text text-transparent">Key Features</h2>
            <motion.div 
              className="h-1 w-20 bg-gradient-to-r from-btb-primary to-blue-600 mx-auto rounded-full"
              animate={{ width: ["20%", "30%", "20%"] }}
              transition={{ duration: 3, repeat: Infinity }}
            />
            <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mt-6">
              CHICKS token offers unique features designed to maximize capital efficiency and yield generation in DeFi.
            </p>
          </motion.div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 relative z-10">
            {/* Highlight feature spotlight */}
            <motion.div 
              className="absolute -top-10 -left-10 w-40 h-40 bg-btb-primary opacity-5 rounded-full blur-3xl pointer-events-none z-0"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 4, repeat: Infinity }}
            />
            
            {chicksFeatures.map((feature, index) => (
              <FeatureCard
                key={feature.title}
                title={feature.title}
                description={feature.description}
                icon={feature.icon}
                color={feature.color}
                index={index}
                highlight={feature.highlight}
              />
            ))}
          </div>
          
          {/* Feature highlight callout */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            viewport={{ once: true }}
            className="mt-16 max-w-4xl mx-auto"
          >
            <div className="bg-gradient-to-r from-btb-primary/10 to-blue-500/10 rounded-xl p-6 border border-btb-primary/20">
              <div className="flex flex-col md:flex-row items-center">
                <div className="md:w-1/4 mb-4 md:mb-0 flex justify-center">
                  <motion.div
                    className="w-24 h-24 rounded-full bg-gradient-to-r from-btb-primary to-blue-600 flex items-center justify-center text-white text-3xl font-bold"
                    animate={{ 
                      boxShadow: ['0 0 0 rgba(79, 70, 229, 0.2)', '0 0 30px rgba(79, 70, 229, 0.6)', '0 0 0 rgba(79, 70, 229, 0.2)']
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    99%
                  </motion.div>
                </div>
                <div className="md:w-3/4 md:pl-6">
                  <h3 className="text-xl font-bold mb-2 text-btb-primary">Industry-Leading LTV Ratio</h3>
                  <p className="text-gray-700 dark:text-gray-300">
                    With CHICKS, you can borrow up to 99% of your token value, creating the most capital-efficient DeFi experience available. This unprecedented LTV ratio enables powerful leveraging strategies and maximizes your capital utilization.
                  </p>
                  <div className="mt-4 flex items-center">
                    <div className="flex-grow h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full bg-gradient-to-r from-btb-primary to-blue-600"
                        initial={{ width: '0%' }}
                        animate={{ width: '99%' }}
                        transition={{ duration: 1, delay: 0.5 }}
                      />
                    </div>
                    <span className="ml-2 text-sm font-medium text-btb-primary">99% LTV</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
      
      {/* How It Works Section */}
      <section className="py-24 bg-gray-50 dark:bg-gray-800 relative overflow-hidden">
        {/* Animated gradient background */}
        <motion.div 
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            background: "linear-gradient(135deg, rgba(16, 185, 129, 0.3), rgba(59, 130, 246, 0.3), rgba(16, 185, 129, 0.3))",
            backgroundSize: "200% 200%"
          }}
          animate={{
            backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"]
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: "linear"
          }}
        />
        
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <motion.div
            className="absolute top-1/4 left-10 w-32 h-32 rounded-full border-4 border-btb-primary/10 opacity-50"
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
          />
          <motion.div
            className="absolute bottom-1/4 right-10 w-40 h-40 rounded-full border-2 border-dashed border-btb-primary/20 opacity-40"
            animate={{ rotate: [360, 0] }}
            transition={{ duration: 50, repeat: Infinity, ease: "linear" }}
          />
          <motion.div
            className="absolute top-1/2 right-1/4 w-24 h-24 rounded-full bg-green-500/5"
            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute bottom-1/3 left-1/4 w-16 h-16 rounded-full bg-blue-500/5"
            animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.5, 0.2] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="mb-16 text-center"
          >
            <span className="inline-block px-3 py-1 bg-green-500/10 text-green-600 dark:text-green-400 text-sm font-medium rounded-full mb-3">
              SIMPLE PROCESS
            </span>
            <h2 className="text-4xl font-bold mb-6 bg-gradient-to-r from-green-500 to-blue-600 bg-clip-text text-transparent">How CHICKS Works</h2>
            <motion.div 
              className="h-1 w-20 bg-gradient-to-r from-green-500 to-blue-600 mx-auto rounded-full"
              animate={{ width: ["20%", "30%", "20%"] }}
              transition={{ duration: 3, repeat: Infinity }}
            />
            <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mt-6">
              A step-by-step guide to understanding the CHICKS token mechanism and how to maximize your returns.
            </p>
          </motion.div>
          
          {/* Interactive Flow Diagram */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="max-w-5xl mx-auto mb-16 hidden lg:block"
          >
            <div className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow-md border border-gray-100 dark:border-gray-800 relative overflow-hidden">
              <div className="absolute inset-0 overflow-hidden opacity-5">
                <svg width="100%" height="100%" viewBox="0 0 800 200" xmlns="http://www.w3.org/2000/svg">
                  <path d="M0,100 C100,50 200,150 300,100 C400,50 500,150 600,100 C700,50 800,150 900,100" stroke="#4f46e5" strokeWidth="2" fill="none" />
                  <path d="M0,120 C100,70 200,170 300,120 C400,70 500,170 600,120 C700,70 800,170 900,120" stroke="#10b981" strokeWidth="2" fill="none" />
                  <path d="M0,80 C100,30 200,130 300,80 C400,30 500,130 600,80 C700,30 800,130 900,80" stroke="#3b82f6" strokeWidth="2" fill="none" />
                </svg>
              </div>
              
              <div className="relative z-10">
                <h3 className="text-xl font-bold mb-6 text-center">CHICKS Token Flow</h3>
                
                <div className="flex justify-between items-center">
                  {[
                    { title: "Deposit", icon: CurrencyDollarIcon, color: "bg-blue-500" },
                    { title: "Mint", icon: SparklesIcon, color: "bg-purple-500" },
                    { title: "Borrow", icon: BanknotesIcon, color: "bg-btb-primary" },
                    { title: "Leverage", icon: ArrowTrendingUpIcon, color: "bg-green-500" }
                  ].map((item, index) => (
                    <div key={item.title} className="flex flex-col items-center relative">
                      <motion.div 
                        className={`w-16 h-16 rounded-full ${item.color} flex items-center justify-center shadow-lg`}
                        whileHover={{ scale: 1.1 }}
                        animate={{ 
                          y: [0, -5, 0],
                          boxShadow: [
                            '0 4px 6px rgba(0,0,0,0.1)', 
                            '0 10px 15px rgba(0,0,0,0.2)', 
                            '0 4px 6px rgba(0,0,0,0.1)'
                          ] 
                        }}
                        transition={{ 
                          y: { duration: 2, repeat: Infinity, ease: "easeInOut" },
                          boxShadow: { duration: 2, repeat: Infinity, ease: "easeInOut" }
                        }}
                      >
                        <item.icon className="w-8 h-8 text-white" />
                      </motion.div>
                      
                      <p className="mt-2 font-medium">{item.title}</p>
                      
                      {index < 3 && (
                        <motion.div 
                          className="absolute top-8 left-full w-full h-0.5 bg-gradient-to-r from-gray-300 to-gray-400 dark:from-gray-600 dark:to-gray-700 transform -translate-y-1/2"
                          style={{ width: 'calc(100% - 4rem)' }}
                          initial={{ scaleX: 0, originX: 0 }}
                          whileInView={{ scaleX: 1 }}
                          transition={{ duration: 0.8, delay: index * 0.2 }}
                          viewport={{ once: true }}
                        >
                          <motion.div 
                            className="absolute right-0 -top-1 w-2 h-2 bg-gray-400 dark:bg-gray-600 transform rotate-45"
                            initial={{ opacity: 0 }}
                            whileInView={{ opacity: 1 }}
                            transition={{ duration: 0.3, delay: index * 0.2 + 0.7 }}
                            viewport={{ once: true }}
                          />
                        </motion.div>
                      )}
                    </div>
                  ))}
                </div>
                
                <div className="mt-8 grid grid-cols-4 gap-4">
                  {[
                    { text: "Deposit USDC to the protocol", highlight: false },
                    { text: "Receive CHICKS tokens", highlight: false },
                    { text: "Borrow up to 99% LTV", highlight: true },
                    { text: "Amplify returns through leverage", highlight: false }
                  ].map((item, index) => (
                    <motion.div 
                      key={index}
                      className={`text-center text-sm p-2 rounded ${item.highlight ? 'bg-btb-primary/10 border border-btb-primary/20' : ''}`}
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.1 * index }}
                      viewport={{ once: true }}
                    >
                      <p className={item.highlight ? 'text-btb-primary font-medium' : 'text-gray-600 dark:text-gray-400'}>
                        {item.text}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
          
          <div className="max-w-5xl mx-auto">
            {[
              {
                step: 1,
                title: "Deposit USDC",
                description: "Users deposit USDC into the protocol, which is then deposited into Aave to generate yield. Your deposit is fully secured and can be withdrawn at any time.",
                icon: CurrencyDollarIcon,
                color: "from-blue-500 to-blue-600",
                image: "/images/deposit.svg",
                details: [
                  "100% USDC-backed token with controlled supply",
                  "Generates yield through Aave deposits",
                  "No lock-up period, withdraw anytime"
                ]
              },
              {
                step: 2,
                title: "Mint CHICKS",
                description: "CHICKS tokens are minted against USDC deposits in the protocol. The minting process includes a small fee that contributes to the protocol's growth and stability.",
                icon: SparklesIcon,
                color: "from-purple-500 to-indigo-600",
                image: "/images/mint.svg",
                details: [
                  "2.5% standard minting fee (1% for leveraged positions)",
                  "Tokens represent your stake in the protocol",
                  "Fully backed by USDC reserves"
                ]
              },
              {
                step: 3,
                title: "Borrow Against CHICKS",
                description: "Use your CHICKS as collateral to borrow up to 99% of its value in USDC or other assets. This industry-leading LTV ratio maximizes your capital efficiency.",
                icon: BanknotesIcon,
                color: "from-btb-primary to-blue-600",
                image: "/images/borrow.svg",
                details: [
                  "Industry-leading 99% LTV ratio",
                  "Borrow USDC or other supported assets",
                  "Smart liquidation mechanisms for safety"
                ],
                highlight: true
              },
              {
                step: 4,
                title: "Leverage or Yield Farm",
                description: "Use borrowed funds to buy more CHICKS or deploy in other DeFi protocols for additional yield. Repeat the process to create powerful leveraged positions.",
                icon: ArrowTrendingUpIcon,
                color: "from-green-500 to-teal-600",
                image: "/images/leverage.svg",
                details: [
                  "Create leveraged positions up to 100x",
                  "Deploy capital in other yield-generating protocols",
                  "Compound returns through recursive borrowing"
                ]
              }
            ].map((step, index) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="mb-12 last:mb-0"
              >
                <div className={`flex flex-col md:flex-row items-stretch bg-white dark:bg-gray-900 rounded-xl shadow-sm border ${step.highlight ? 'border-btb-primary/30' : 'border-gray-100 dark:border-gray-800'} overflow-hidden`}>
                  <div className="md:w-1/3 p-8 flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 h-full relative overflow-hidden">
                    {/* Background pattern */}
                    <motion.div 
                      className="absolute inset-0 opacity-5"
                      animate={{ rotate: [0, 360] }}
                      transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
                    >
                      <svg width="100%" height="100%" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                          <pattern id={`grid-${step.step}`} width="10" height="10" patternUnits="userSpaceOnUse">
                            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" strokeWidth="0.5" />
                          </pattern>
                        </defs>
                        <rect width="100" height="100" fill={`url(#grid-${step.step})`} />
                      </svg>
                    </motion.div>
                    
                    <div className="relative mb-4">
                      <motion.div 
                        className={`w-16 h-16 rounded-full bg-gradient-to-r ${step.color} flex items-center justify-center text-white text-2xl font-bold ${step.highlight ? 'ring-4 ring-btb-primary/20' : ''}`}
                        animate={{ 
                          boxShadow: ['0 0 0 rgba(255,255,255,0)', '0 0 20px rgba(255,255,255,0.5)', '0 0 0 rgba(255,255,255,0)'] 
                        }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        {step.step}
                      </motion.div>
                      {index < 3 && (
                        <motion.div 
                          className="absolute top-full left-1/2 transform -translate-x-1/2 w-1 h-12 mt-2 hidden md:block"
                          initial={{ height: 0 }}
                          whileInView={{ height: 48 }}
                          transition={{ duration: 0.5, delay: 0.3 }}
                          viewport={{ once: true }}
                        >
                          <div className={`w-full h-full bg-gradient-to-b ${step.color}`}></div>
                        </motion.div>
                      )}
                    </div>
                    <motion.div 
                      className="w-20 h-20 mb-4"
                      whileHover={{ scale: 1.1, rotate: 5 }}
                    >
                      <step.icon className={`w-full h-full text-gradient-to-r ${step.color}`} />
                    </motion.div>
                    <h3 className={`text-xl font-bold text-center ${step.highlight ? 'bg-gradient-to-r from-btb-primary to-blue-600 bg-clip-text text-transparent' : 'bg-gradient-to-r from-gray-800 to-gray-900 dark:from-gray-100 dark:to-white bg-clip-text text-transparent'}`}>
                      {step.title}
                    </h3>
                    
                    {step.highlight && (
                      <motion.div
                        className="mt-4 px-3 py-1 bg-btb-primary/20 rounded-full text-xs font-bold text-btb-primary"
                        initial={{ scale: 0.8, opacity: 0 }}
                        whileInView={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.3, delay: 0.5 }}
                        viewport={{ once: true }}
                      >
                        FEATURED
                      </motion.div>
                    )}
                  </div>
                  
                  <div className="md:w-2/3 p-8">
                    <p className="text-gray-600 dark:text-gray-300 mb-6 text-lg">
                      {step.description}
                    </p>
                    
                    <div className="mb-6">
                      <h4 className="text-sm font-semibold uppercase text-gray-500 dark:text-gray-400 mb-3">Key Benefits</h4>
                      <div className="space-y-2">
                        {step.details.map((detail, i) => (
                          <motion.div 
                            key={i}
                            className="flex items-start"
                            initial={{ opacity: 0, x: -10 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.3, delay: 0.1 * i }}
                            viewport={{ once: true }}
                          >
                            <div className={`flex-shrink-0 p-1 rounded-full bg-gradient-to-r ${step.color} mr-3 mt-0.5`}>
                              <CheckIcon className="w-3 h-3 text-white" />
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-300">{detail}</p>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="mt-4">
                      <motion.div 
                        className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden"
                        initial={{ width: '0%' }}
                        whileInView={{ width: '100%' }}
                        transition={{ duration: 0.8 }}
                        viewport={{ once: true }}
                      >
                        <motion.div 
                          className={`h-full bg-gradient-to-r ${step.color}`}
                          initial={{ width: '0%' }}
                          whileInView={{ width: '100%' }}
                          transition={{ duration: 1, delay: 0.4 }}
                          viewport={{ once: true }}
                        />
                      </motion.div>
                      
                      {step.step === 3 && (
                        <div className="mt-4 p-4 bg-btb-primary/10 rounded-lg border border-btb-primary/20">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 mr-4">
                              <motion.div 
                                className="w-16 h-16 rounded-full bg-btb-primary/20 flex items-center justify-center"
                                animate={{ 
                                  scale: [1, 1.05, 1],
                                  boxShadow: [
                                    '0 0 0 rgba(79, 70, 229, 0.2)', 
                                    '0 0 20px rgba(79, 70, 229, 0.4)', 
                                    '0 0 0 rgba(79, 70, 229, 0.2)'
                                  ] 
                                }}
                                transition={{ duration: 2, repeat: Infinity }}
                              >
                                <span className="text-btb-primary text-2xl font-bold">99%</span>
                              </motion.div>
                            </div>
                            <div>
                              <h4 className="text-lg font-bold text-btb-primary mb-1">Industry-Leading LTV Ratio</h4>
                              <p className="text-sm text-gray-700 dark:text-gray-300">
                                CHICKS offers an unprecedented 99% LTV ratio, allowing you to maximize capital efficiency and create powerful leveraged positions with minimal capital lockup.
                              </p>
                              <div className="mt-2 flex items-center">
                                <div className="flex-grow h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                  <motion.div 
                                    className="h-full bg-gradient-to-r from-btb-primary to-blue-600"
                                    initial={{ width: '0%' }}
                                    whileInView={{ width: '99%' }}
                                    transition={{ duration: 1, delay: 0.5 }}
                                    viewport={{ once: true }}
                                  />
                                </div>
                                <span className="ml-2 text-sm font-medium text-btb-primary">99% LTV</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
          
          {/* Comparison with other protocols */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            viewport={{ once: true }}
            className="mt-16 max-w-4xl mx-auto"
          >
            <div className="bg-white dark:bg-gray-900 rounded-xl p-8 shadow-md border border-gray-100 dark:border-gray-800">
              <h3 className="text-2xl font-bold mb-6 text-center">CHICKS vs. Other Protocols</h3>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800">
                      <th className="py-3 px-4 text-left">Feature</th>
                      <th className="py-3 px-4 text-center bg-btb-primary/10 text-btb-primary font-bold">CHICKS</th>
                      <th className="py-3 px-4 text-center">Typical DeFi Protocol</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { feature: "Maximum LTV", chicks: "99%", others: "50-80%" },
                      { feature: "Backing", chicks: "100% USDC", others: "Variable" },
                      { feature: "Liquidation Threshold", chicks: "99.5%", others: "65-85%" },
                      { feature: "Recursive Borrowing", chicks: "Up to 100x", others: "Limited" }
                    ].map((row, index) => (
                      <motion.tr 
                        key={index}
                        className={index % 2 === 0 ? 'bg-gray-50 dark:bg-gray-800/50' : ''}
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.1 }}
                        viewport={{ once: true }}
                      >
                        <td className="py-3 px-4 font-medium">{row.feature}</td>
                        <td className="py-3 px-4 text-center bg-btb-primary/5 text-btb-primary font-bold">{row.chicks}</td>
                        <td className="py-3 px-4 text-center text-gray-600 dark:text-gray-400">{row.others}</td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
          
          {/* Advanced Mechanisms Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            viewport={{ once: true }}
            className="mt-16 max-w-5xl mx-auto"
          >
            <div className="bg-white dark:bg-gray-900 rounded-xl p-8 shadow-md border border-gray-100 dark:border-gray-800 overflow-hidden relative">
              {/* Decorative background elements */}
              <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-blue-500/5 rounded-full blur-2xl pointer-events-none"></div>
              <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-60 h-60 bg-purple-500/5 rounded-full blur-3xl pointer-events-none"></div>
              
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                viewport={{ once: true }}
                className="text-center mb-12"
              >
                <h3 className="text-2xl font-bold mb-2 bg-gradient-to-r from-btb-primary to-blue-600 bg-clip-text text-transparent">Advanced CHICKS Mechanisms</h3>
                <div className="w-24 h-1 bg-gradient-to-r from-btb-primary to-blue-600 mx-auto rounded-full mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                  Discover the powerful financial tools and mechanisms that make CHICKS the most capital-efficient token in DeFi.
                </p>
              </motion.div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Borrowing & Loans Panel */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  viewport={{ once: true }}
                  className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-800/10 rounded-xl border border-blue-200/50 dark:border-blue-800/30 p-6 overflow-hidden relative"
                >
                  <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
                  
                  <div className="flex items-start mb-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center mr-4">
                      <BanknotesIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-blue-800 dark:text-blue-300 mb-1">Borrowing & Loans</h4>
                      <p className="text-blue-700/80 dark:text-blue-400/80 text-sm">Industry-leading capital efficiency</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center mb-1">
                        <CheckIcon className="w-4 h-4 text-blue-600 dark:text-blue-400 mr-2" />
                        <h5 className="font-medium text-gray-800 dark:text-gray-200">Collateral Requirement</h5>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 pl-6">
                        Up to 99% of the CHICKS' value may be borrowed in USDC.
                      </p>
                    </div>
                    
                    <div>
                      <div className="flex items-center mb-1">
                        <CheckIcon className="w-4 h-4 text-blue-600 dark:text-blue-400 mr-2" />
                        <h5 className="font-medium text-gray-800 dark:text-gray-200">Duration & Interest</h5>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 pl-6">
                        Loan duration from 1 to 365 days with a linear interest model that sets a base rate (e.g., 0.05% for 1 day), increasing with loan duration.
                      </p>
                    </div>
                    
                    <div>
                      <div className="flex items-center mb-1">
                        <CheckIcon className="w-4 h-4 text-blue-600 dark:text-blue-400 mr-2" />
                        <h5 className="font-medium text-gray-800 dark:text-gray-200">Liquidation</h5>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 pl-6">
                        If a loan defaults, the CHICKS collateral is burned, increasing the ratio of USDC to CHICKS, thereby raising the token's intrinsic value.
                      </p>
                    </div>
                    
                    <div>
                      <div className="flex items-center mb-1">
                        <CheckIcon className="w-4 h-4 text-blue-600 dark:text-blue-400 mr-2" />
                        <h5 className="font-medium text-gray-800 dark:text-gray-200">Loan Default Method</h5>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 pl-6">
                        Users can open a loan against their CHICKS and purposefully default, causing their CHICKS collateral to be burned in exchange for the underlying USDC (minus fees and any required collateral premium).
                      </p>
                    </div>
                  </div>
                  
                  <motion.div 
                    className="absolute bottom-2 right-2 opacity-10 pointer-events-none"
                    animate={{ 
                      rotate: [0, 5, 0, -5, 0],
                      scale: [1, 1.05, 1, 0.95, 1]
                    }}
                    transition={{ duration: 8, repeat: Infinity }}
                  >
                    <BanknotesIcon className="w-24 h-24 text-blue-500" />
                  </motion.div>
                </motion.div>
                
                {/* Leveraging (Looping) Panel */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  viewport={{ once: true }}
                  className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-900/20 dark:to-purple-800/10 rounded-xl border border-purple-200/50 dark:border-purple-800/30 p-6 overflow-hidden relative"
                >
                  <div className="absolute top-0 right-0 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>
                  
                  <div className="flex items-start mb-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-r from-purple-500 to-purple-600 flex items-center justify-center mr-4">
                      <ArrowTrendingUpIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-purple-800 dark:text-purple-300 mb-1">Leveraging (Looping)</h4>
                      <p className="text-purple-700/80 dark:text-purple-400/80 text-sm">Advanced strategies for power users</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center mb-1">
                        <CheckIcon className="w-4 h-4 text-purple-600 dark:text-purple-400 mr-2" />
                        <h5 className="font-medium text-gray-800 dark:text-gray-200">Mechanism</h5>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 pl-6">
                        Borrow USDC against CHICKS collateral, then use that borrowed USDC to mint more CHICKS, creating powerful leveraged exposure with minimal capital outlay.
                      </p>
                    </div>
                    
                    <div>
                      <div className="flex items-center mb-1">
                        <CheckIcon className="w-4 h-4 text-purple-600 dark:text-purple-400 mr-2" />
                        <h5 className="font-medium text-gray-800 dark:text-gray-200">UI Support</h5>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 pl-6">
                        A streamlined interface on the CHICKS Finance website allows creating and unwinding these leveraged positions in a single transaction.
                      </p>
                    </div>
                    
                    <div>
                      <div className="flex items-center mb-1">
                        <CheckIcon className="w-4 h-4 text-purple-600 dark:text-purple-400 mr-2" />
                        <h5 className="font-medium text-gray-800 dark:text-gray-200">Fee Discount</h5>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 pl-6">
                        When opening leveraged positions, the minting fee is discounted from 2.5% to 1%.
                      </p>
                    </div>
                    
                    <div>
                      <div className="flex items-center mb-1">
                        <CheckIcon className="w-4 h-4 text-purple-600 dark:text-purple-400 mr-2" />
                        <h5 className="font-medium text-gray-800 dark:text-gray-200">Liquidation Risk</h5>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 pl-6">
                        Leverage increases risk; a default results in burning the collateral.
                      </p>
                    </div>
                  </div>
                  
                  <motion.div 
                    className="absolute bottom-2 right-2 opacity-10 pointer-events-none"
                    animate={{ 
                      rotate: [0, 5, 0, -5, 0],
                      scale: [1, 1.05, 1, 0.95, 1]
                    }}
                    transition={{ duration: 8, repeat: Infinity }}
                  >
                    <ArrowTrendingUpIcon className="w-24 h-24 text-purple-500" />
                  </motion.div>
                </motion.div>
                
                {/* Aave Income Panel */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  viewport={{ once: true }}
                  className="bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-900/20 dark:to-green-800/10 rounded-xl border border-green-200/50 dark:border-green-800/30 p-6 overflow-hidden relative"
                >
                  <div className="absolute top-0 right-0 w-40 h-40 bg-green-500/10 rounded-full blur-3xl pointer-events-none"></div>
                  
                  <div className="flex items-start mb-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-r from-green-500 to-green-600 flex items-center justify-center mr-4">
                      <ArrowPathIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-green-800 dark:text-green-300 mb-1">Extra Income from Aave</h4>
                      <p className="text-green-700/80 dark:text-green-400/80 text-sm">Optimized yield generation</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center mb-1">
                        <CheckIcon className="w-4 h-4 text-green-600 dark:text-green-400 mr-2" />
                        <h5 className="font-medium text-gray-800 dark:text-gray-200">Just-in-Time Withdrawals</h5>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 pl-6">
                        The protocol automatically withdraws from Aave to fulfill redemption requests, optimizing yield generation during idle periods.
                      </p>
                    </div>
                    
                    <div>
                      <div className="flex items-center mb-1">
                        <CheckIcon className="w-4 h-4 text-green-600 dark:text-green-400 mr-2" />
                        <h5 className="font-medium text-gray-800 dark:text-gray-200">Increased APY</h5>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 pl-6">
                        CHICKS holders benefit from part of the Aave yield, creating a sustainable source of additional returns without additional capital exposure.
                      </p>
                    </div>
                    
                    <div>
                      <div className="flex items-center mb-1">
                        <CheckIcon className="w-4 h-4 text-green-600 dark:text-green-400 mr-2" />
                        <h5 className="font-medium text-gray-800 dark:text-gray-200">Adaptive Strategy</h5>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 pl-6">
                        As lending rates change, the protocol can dynamically manage positions on Aave to maximize yields.
                      </p>
                    </div>
                  </div>
                  
                  <motion.div 
                    className="absolute bottom-2 right-2 opacity-10 pointer-events-none"
                    animate={{ 
                      rotate: [0, 5, 0, -5, 0],
                      scale: [1, 1.05, 1, 0.95, 1]
                    }}
                    transition={{ duration: 8, repeat: Infinity }}
                  >
                    <ArrowPathIcon className="w-24 h-24 text-green-500" />
                  </motion.div>
                </motion.div>
                
                {/* Flash Loans Panel */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.4 }}
                  viewport={{ once: true }}
                  className="bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-900/20 dark:to-amber-800/10 rounded-xl border border-amber-200/50 dark:border-amber-800/30 p-6 overflow-hidden relative"
                >
                  <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
                  
                  <div className="flex items-start mb-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 flex items-center justify-center mr-4">
                      <BoltIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-amber-800 dark:text-amber-300 mb-1">Flash Loans</h4>
                      <p className="text-amber-700/80 dark:text-amber-400/80 text-sm">Advanced DeFi strategies</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center mb-1">
                        <CheckIcon className="w-4 h-4 text-amber-600 dark:text-amber-400 mr-2" />
                        <h5 className="font-medium text-gray-800 dark:text-gray-200">Supply Cap</h5>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 pl-6">
                        Once the supply cap of 100,000,000,000 CHICKS is reached, loan collateral can only be sourced by buying CHICKS from external markets.
                      </p>
                    </div>
                    
                    <div>
                      <div className="flex items-center mb-1">
                        <CheckIcon className="w-4 h-4 text-amber-600 dark:text-amber-400 mr-2" />
                        <h5 className="font-medium text-gray-800 dark:text-gray-200">Use Cases</h5>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 pl-6">
                        Facilitate a wide range of DeFi activities—arbitrage, leverage, or liquidation with a straightforward flash-loan feature.
                      </p>
                    </div>
                    
                    <div>
                      <div className="flex items-center mb-1">
                        <CheckIcon className="w-4 h-4 text-amber-600 dark:text-amber-400 mr-2" />
                        <h5 className="font-medium text-gray-800 dark:text-gray-200">Fee Structure</h5>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 pl-6">
                        CHICKS Finance offers flash loans with a 1% fee.
                      </p>
                    </div>
                  </div>
                  
                  <motion.div 
                    className="absolute bottom-2 right-2 opacity-10 pointer-events-none"
                    animate={{ 
                      rotate: [0, 5, 0, -5, 0],
                      scale: [1, 1.05, 1, 0.95, 1]
                    }}
                    transition={{ duration: 8, repeat: Infinity }}
                  >
                    <BoltIcon className="w-24 h-24 text-amber-500" />
                  </motion.div>
                </motion.div>
              </div>
            </div>
          </motion.div>
          
          {/* Interactive callout */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            viewport={{ once: true }}
            className="mt-16 max-w-3xl mx-auto text-center"
          >
            <div className="bg-gradient-to-r from-btb-primary/10 to-blue-500/10 rounded-xl p-8 shadow-md border border-btb-primary/20">
              <h3 className="text-2xl font-bold mb-4 bg-gradient-to-r from-btb-primary to-blue-600 bg-clip-text text-transparent">
                Ready to Start Your CHICKS Journey?
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Join thousands of users already leveraging the power of CHICKS for maximum capital efficiency.
              </p>
              <motion.div 
                whileHover={{ scale: 1.05 }} 
                whileTap={{ scale: 0.95 }}
                className="inline-block"
              >
                <Link href="/chicks/trade">
                  <Button size="lg" className="bg-gradient-to-r from-btb-primary to-blue-600 hover:from-btb-primary-dark hover:to-blue-700">
                    Launch App
                  </Button>
                </Link>
              </motion.div>
              
              <div className="mt-6 flex justify-center space-x-4">
                <motion.a 
                  href="#" 
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-btb-primary dark:hover:text-btb-primary flex items-center"
                  whileHover={{ scale: 1.05 }}
                >
                  <DocumentTextIcon className="w-4 h-4 mr-1" />
                  Read Docs
                </motion.a>
                <motion.a 
                  href="#" 
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-btb-primary dark:hover:text-btb-primary flex items-center"
                  whileHover={{ scale: 1.05 }}
                >
                  <ChatBubbleLeftRightIcon className="w-4 h-4 mr-1" />
                  Join Community
                </motion.a>
                <motion.a 
                  href="#" 
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-btb-primary dark:hover:text-btb-primary flex items-center"
                  whileHover={{ scale: 1.05 }}
                >
                  <PlayCircleIcon className="w-4 h-4 mr-1" />
                  Watch Tutorial
                </motion.a>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
      
      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-btb-primary to-btb-primary-light text-white relative overflow-hidden">
        {/* Animated particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {particles.map((particle) => (
            <motion.div
              key={particle.id}
              className="absolute w-2 h-2 rounded-full bg-white opacity-20"
              style={{
                top: `${particle.top}%`,
                left: `${particle.left}%`,
              }}
              animate={{
                y: [0, particle.animationY],
                opacity: [0, 0.5, 0],
                scale: [0, 1, particle.scale]
              }}
              transition={{
                duration: particle.duration,
                repeat: Infinity,
                delay: particle.delay,
                ease: "easeOut"
              }}
            />
          ))}
        </div>
        
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto text-center"
          >
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <h2 className="text-4xl font-bold mb-6">Ready to Experience CHICKS?</h2>
            </motion.div>
            <p className="text-xl mb-8 opacity-90">
              Join thousands of users already leveraging the power of the most capital efficient token in DeFi.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <motion.div 
                whileHover={{ scale: 1.05 }} 
                whileTap={{ scale: 0.95 }}
                animate={{ 
                  boxShadow: ['0 0 0 rgba(255,255,255,0.2)', '0 0 20px rgba(255,255,255,0.5)', '0 0 0 rgba(255,255,255,0.2)'] 
                }}
                transition={{ boxShadow: { duration: 2, repeat: Infinity } }}
              >
                <Link href="/chicks/trade">
                  <Button 
                    size="lg" 
                    className="bg-white text-btb-primary hover:bg-gray-100"
                    leftIcon={<CurrencyDollarIcon className="w-5 h-5" />}
                  >
                    Buy CHICKS Now
                  </Button>
                </Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button 
                  size="lg" 
                  variant="outline"
                  className="border-white text-white hover:bg-white/10"
                  leftIcon={<QuestionMarkCircleIcon className="w-5 h-5" />}
                >
                  Read Documentation
                </Button>
              </motion.div>
            </div>
            
            {/* Feature highlights instead of animated counters */}
            <motion.div 
              className="flex flex-wrap justify-center gap-8 mt-12"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              viewport={{ once: true }}
            >
              {[
                { label: 'Security', value: '100% Backed', icon: '🔒' },
                { label: 'Efficiency', value: '99% LTV', icon: '⚡' },
                { label: 'Innovation', value: 'Advanced DeFi', icon: '✨' }
              ].map((feature, index) => (
                <motion.div
                  key={index}
                  className="text-center"
                  whileHover={{ y: -5 }}
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ scale: { duration: 2, delay: index * 0.2, repeat: Infinity } }}
                >
                  <motion.div
                    className="text-3xl mb-1"
                    animate={{ y: [0, -5, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    {feature.icon}
                  </motion.div>
                  <motion.p 
                    className="text-xl font-bold"
                    animate={{ opacity: [0.8, 1, 0.8] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    {feature.value}
                  </motion.p>
                  <p className="text-sm opacity-80">{feature.label}</p>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
