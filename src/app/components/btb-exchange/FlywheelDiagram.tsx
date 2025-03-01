'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { ArrowPathIcon, CubeIcon, ArrowsPointingOutIcon, ArrowsPointingInIcon } from '@heroicons/react/24/outline';
import { Button } from '@/app/components/ui/button';

interface StepProps {
  number: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  active: boolean;
  onClick?: () => void;
  color?: string;
}

// Particle effect component for connections between steps
const ParticleFlow: React.FC<{ active: boolean; color: string }> = ({ active, color }) => {
  return (
    <motion.div
      className="absolute inset-0 overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: active ? 1 : 0 }}
      transition={{ duration: 0.5 }}
    >
      {[...Array(15)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: color }}
          initial={{ 
            x: '0%', 
            y: '50%',
            opacity: 0 
          }}
          animate={{
            x: ['0%', '100%'],
            y: ['50%', '50%'],
            opacity: [0, 1, 0],
            scale: [0.8, 1.2, 0.8]
          }}
          transition={{
            duration: 3,
            delay: i * 0.2,
            repeat: Infinity,
            repeatType: "loop",
            ease: "easeInOut"
          }}
        />
      ))}
    </motion.div>
  );
};

// Hexagon shape for the prism faces
const HexagonShape: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <svg 
      viewBox="0 0 100 100" 
      className={`absolute inset-0 w-full h-full ${className || ''}`}
    >
      <polygon 
        points="50,3 100,28 100,72 50,97 0,72 0,28" 
        fill="none" 
        strokeWidth="1.5"
        className="stroke-btb-primary/60"
      />
    </svg>
  );
};

const PrismFace: React.FC<StepProps> = ({ number, title, description, icon, active, onClick, color = '#3B82F6' }) => {
  return (
    <motion.div
      className={`absolute inset-0 flex flex-col items-center justify-center p-6 backdrop-blur-sm ${active ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
      initial={{ opacity: 0, scale: 0.8, rotateY: 60 }}
      animate={{ 
        opacity: active ? 1 : 0, 
        scale: active ? 1 : 0.8,
        rotateY: active ? 0 : 60
      }}
      transition={{ duration: 0.7, type: "spring", stiffness: 100 }}
      onClick={onClick}
    >
      <HexagonShape className="opacity-70" />
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent rounded-xl backdrop-blur-sm border border-white/20 shadow-xl"></div>
      <div className="flex flex-col items-center text-center">
        <motion.div 
          className="w-16 h-16 mb-4 flex items-center justify-center rounded-full bg-gradient-to-br from-btb-primary to-btb-primary-dark text-white shadow-lg relative z-10"
          animate={{ 
            scale: active ? [1, 1.05, 1] : 1,
            boxShadow: active ? '0 0 30px rgba(59, 130, 246, 0.8)' : '0 0 0 rgba(59, 130, 246, 0)'
          }}
          transition={{ 
            duration: 1.5, 
            repeat: Infinity, 
            repeatType: "reverse" 
          }}
        >
          <motion.div 
            className="absolute inset-0 rounded-full bg-btb-primary-light/30 blur-md"
            animate={{ 
              scale: active ? [0.8, 1.2, 0.8] : 0.8,
              opacity: active ? [0.4, 0.7, 0.4] : 0.4
            }}
            transition={{ 
              duration: 2, 
              repeat: Infinity,
              repeatType: "reverse" 
            }}
          />
          {icon}
        </motion.div>
        
        <h3 className="text-xl font-bold text-btb-primary-dark mb-2 relative z-10">{title}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 max-w-xs relative z-10">{description}</p>
        
        <motion.div 
          className="mt-4 w-8 h-8 rounded-full bg-btb-primary flex items-center justify-center text-white font-bold"
          animate={{ 
            backgroundColor: ['#3B82F6', '#2563EB', '#3B82F6'],
            boxShadow: ['0 0 0px rgba(59, 130, 246, 0)', '0 0 15px rgba(59, 130, 246, 0.7)', '0 0 0px rgba(59, 130, 246, 0)']
          }}
          transition={{ 
            duration: 2, 
            repeat: Infinity,
            repeatType: "loop" 
          }}
        >
          {number}
        </motion.div>
      </div>
    </motion.div>
  );
};

const FlywheelDiagram: React.FC = () => {
  const [activeStep, setActiveStep] = useState(1);
  const [isAnimating, setIsAnimating] = useState(true);
  const [rotationSpeed, setRotationSpeed] = useState(1);
  const [isRotating, setIsRotating] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isExploded, setIsExploded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Motion values for interactive 3D effect
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useTransform(mouseY, [-300, 300], [10, -10]);
  const rotateY = useTransform(mouseX, [-300, 300], [-10, 10]);

  // Handle manual step selection
  const handleStepClick = (stepNumber: number) => {
    setActiveStep(stepNumber);
    setIsAnimating(false);
  };

  // Toggle animation
  const toggleAnimation = () => {
    setIsAnimating(!isAnimating);
  };

  // Change rotation speed
  const changeSpeed = () => {
    setRotationSpeed(prev => (prev === 1 ? 2 : prev === 2 ? 0.5 : 1));
  };
  
  // Toggle fullscreen mode
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };
  
  // Toggle exploded view
  const toggleExplodedView = () => {
    setIsExploded(!isExploded);
  };
  
  // Handle mouse move for 3D effect
  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      mouseX.set(e.clientX - centerX);
      mouseY.set(e.clientY - centerY);
    }
  };
  
  // Reset mouse position when mouse leaves
  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  // Define steps with icons and colors
  const steps = [
    {
      number: 1,
      title: "Lock BTB Tokens",
      description: "Users must lock BTB tokens to access BTBY/USDC trading, creating exclusive access and steady demand",
      icon: <CubeIcon className="w-8 h-8" />,
      color: '#3B82F6'
    },
    {
      number: 2,
      title: "Trade BTBY/USDC",
      description: "Trading generates 0.1% fees with our unique bonding curve mechanism",
      icon: <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>,
      color: '#14B8A6'
    },
    {
      number: 3,
      title: "Fees to LP",
      description: "All trading fees fund BTBY/ETH liquidity providers on Uniswap, creating incentives for LP providers",
      icon: <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>,
      color: '#06B6D4'
    },
    {
      number: 4,
      title: "Price Always Rises",
      description: "BTBY price increases with BOTH buys AND sells, ensuring continuous upward price trends",
      icon: <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>,
      color: '#8B5CF6'
    },
    {
      number: 5,
      title: "Arbitrage Profit",
      description: "Traders keep 100% of arbitrage profits between platforms, creating a win-win scenario",
      icon: <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>,
      color: '#EC4899'
    },
    {
      number: 6,
      title: "LP Growth",
      description: "Increased trading fees attract more LP providers to BTBY/ETH, enhancing liquidity",
      icon: <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
      </svg>,
      color: '#F59E0B'
    },
    {
      number: 7,
      title: "BTB Holder Rewards",
      description: "BTB token holders benefit from all arbitrage activity, creating long-term value",
      icon: <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>,
      color: '#10B981'
    },
    {
      number: 8,
      title: "Growing Ecosystem",
      description: "Win-win system drives sustainable growth for all participants in the BTB ecosystem",
      icon: <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
      </svg>,
      color: '#4F46E5'
    }
  ];

  useEffect(() => {
    // Set up animation cycle for active step
    if (!isAnimating) return;
    
    const intervalId = setInterval(() => {
      setActiveStep(prev => {
        const next = (prev % steps.length) + 1;
        setIsRotating(true);
        setTimeout(() => setIsRotating(false), 500);
        return next;
      });
    }, 5000 / rotationSpeed);

    return () => clearInterval(intervalId);
  }, [isAnimating, steps.length, rotationSpeed]);

  return (
    <div 
      className={`relative ${isFullscreen ? 'fixed inset-0 z-50 bg-white/95 dark:bg-gray-900/95 p-4' : 'h-[600px] md:h-[700px] mb-12'}`} 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-btb-primary text-center flex-1">The BTB Exchange Ecosystem</h2>
        <div className="flex items-center gap-2">
          <Button
            onClick={toggleAnimation}
            variant="outline"
            size="sm"
            className="flex items-center gap-1"
          >
            <ArrowPathIcon className={`h-4 w-4 ${isAnimating ? 'animate-spin' : ''}`} />
            {isAnimating ? 'Pause' : 'Play'}
          </Button>
          <Button
            onClick={changeSpeed}
            variant="outline"
            size="sm"
            className="flex items-center gap-1"
          >
            {rotationSpeed === 0.5 ? '0.5x' : rotationSpeed === 1 ? '1x' : '2x'}
          </Button>
          <Button
            onClick={toggleExplodedView}
            variant="outline"
            size="sm"
            className="flex items-center gap-1"
          >
            {isExploded ? 'Collapse' : 'Explode'}
          </Button>
          <Button
            onClick={toggleFullscreen}
            variant="outline"
            size="sm"
            className="flex items-center gap-1"
          >
            {isFullscreen ? <ArrowsPointingInIcon className="h-4 w-4" /> : <ArrowsPointingOutIcon className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      <p className="text-center mb-8 text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
        Our revolutionary economic model creates a self-reinforcing ecosystem where everyone wins
      </p>
      
      <div className="relative w-full h-full flex items-center justify-center">
        {/* 3D Prism Container */}
        <motion.div 
          className="relative w-[300px] h-[300px] md:w-[400px] md:h-[400px] perspective-1000"
          style={{
            rotateX: rotateX,
            rotateY: rotateY
          }}
          animate={{
            rotateY: isRotating ? [0, 360] : 0,
            scale: isExploded ? 1.2 : 1
          }}
          transition={{
            duration: 1,
            ease: "easeInOut"
          }}
        >
          {/* Glowing background effect */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-btb-primary-dark/20 via-btb-primary/30 to-btb-primary-light/20 blur-xl"></div>
          
          {/* Connection lines between steps */}
          {steps.map((step, index) => {
            const nextIndex = (index + 1) % steps.length;
            return (
              <div key={`connection-${index}`} className="absolute inset-0 z-0">
                <ParticleFlow 
                  active={activeStep === step.number || activeStep === steps[nextIndex].number}
                  color={step.color}
                />
              </div>
            );
          })}
          
          {/* Prism faces */}
          <div className="relative w-full h-full">
            {steps.map((step) => (
              <PrismFace
                key={step.number}
                number={step.number}
                title={step.title}
                description={step.description}
                icon={step.icon}
                color={step.color}
                active={activeStep === step.number}
                onClick={() => handleStepClick(step.number)}
              />
            ))}
          </div>
        </motion.div>
        
        {/* Step indicators */}
        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
          {steps.map((step) => (
            <motion.button
              key={step.number}
              className={`w-3 h-3 rounded-full ${activeStep === step.number ? `bg-[${step.color}]` : 'bg-gray-300 dark:bg-gray-600'}`}
              style={activeStep === step.number ? { backgroundColor: step.color } : {}}
              whileHover={{ scale: 1.2 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => handleStepClick(step.number)}
            />
          ))}
        </div>
        
        {/* Step navigation */}
        <div className="absolute top-1/2 left-0 right-0 flex justify-between px-4 transform -translate-y-1/2 pointer-events-none">
          <motion.button 
            className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-gray-700 dark:text-white border border-gray-200 dark:border-gray-700 shadow-lg pointer-events-auto"
            whileHover={{ scale: 1.1, backgroundColor: 'rgba(255, 255, 255, 0.3)' }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleStepClick(activeStep === 1 ? steps.length : activeStep - 1)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </motion.button>
          <motion.button 
            className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-gray-700 dark:text-white border border-gray-200 dark:border-gray-700 shadow-lg pointer-events-auto"
            whileHover={{ scale: 1.1, backgroundColor: 'rgba(255, 255, 255, 0.3)' }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleStepClick(activeStep === steps.length ? 1 : activeStep + 1)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default FlywheelDiagram;
