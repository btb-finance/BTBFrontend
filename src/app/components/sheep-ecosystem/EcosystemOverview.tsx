'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  ArrowRightIcon, 
  ArrowsRightLeftIcon,
  ArrowPathIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';

interface EcosystemOverviewProps {
  className?: string;
}

export default function EcosystemOverview({ className = '' }: EcosystemOverviewProps) {
  const steps = [
    {
      title: "Buy Sheep Tokens",
      description: "Users purchase Sheep tokens on DEXs, with a 2% transaction fee applied to all buys and sells.",
      color: "bg-green-500"
    },
    {
      title: "Hold SheepDog for Protection",
      description: "Users hold SheepDog tokens to create a protective barrier that prevents Wolf from eating their Sheep tokens. SheepDog purchases include a 5% team fee.",
      color: "bg-blue-500"
    },
    {
      title: "Wolf Hunger Mechanism",
      description: "Each Wolf NFT has its own hunger level that increases with each feeding. When hungry, it attempts to eat unprotected Sheep tokens.",
      color: "bg-purple-500"
    },
    {
      title: "Ecosystem Fees",
      description: "Wolf imposes a 3% fee when consuming Sheep. These fees are redistributed within the ecosystem to maintain balance.",
      color: "bg-amber-500"
    }
  ];

  const interactions = [
    {
      from: "Sheep Token",
      to: "SheepDog Protection",
      description: "Users who hold Sheep tokens can be protected from Wolf's consumption by also holding SheepDog tokens at a ratio of 1:100.",
      icon: ShieldCheckIcon
    },
    {
      from: "SheepDog Protection",
      to: "Wolf Hunger",
      description: "SheepDog blocks Wolf from eating protected Sheep tokens, forcing Wolf to find unprotected Sheep elsewhere in the ecosystem.",
      icon: ArrowsRightLeftIcon
    },
    {
      from: "Wolf Hunger",
      to: "Sheep Token",
      description: "As Wolf's hunger increases, it consumes unprotected Sheep tokens and collects a 3% fee in the process, which increases its hunger for the next feeding.",
      icon: ArrowPathIcon
    }
  ];

  return (
    <div className={`py-12 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <motion.h2 
            className="text-3xl font-extrabold text-gray-900 dark:text-white sm:text-4xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            How the Ecosystem Works
          </motion.h2>
          <motion.p 
            className="mt-4 max-w-2xl mx-auto text-xl text-gray-500 dark:text-gray-300"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            The Sheep Ecosystem consists of three main components working together to create a balanced and rewarding environment.
          </motion.p>
        </div>

        {/* Ecosystem Flow Steps */}
        <div className="relative">
          <div className="hidden md:block absolute left-1/2 h-full w-0.5 bg-gray-200 dark:bg-gray-700 transform -translate-x-1/2"></div>
          
          <div className="space-y-8 relative">
            {steps.map((step, index) => (
              <motion.div
                key={step.title}
                className="relative"
                initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: index * 0.2 }}
              >
                <div className={`flex ${index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'} items-center`}>
                  <div className="md:w-1/2 p-4">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{step.title}</h3>
                      <p className="text-gray-500 dark:text-gray-300">{step.description}</p>
                    </div>
                  </div>
                  
                  <div className="hidden md:flex justify-center items-center w-0 md:w-0 lg:w-32">
                    <div className={`w-8 h-8 rounded-full ${step.color} flex items-center justify-center z-10`}>
                      <span className="text-white font-bold text-sm">{index + 1}</span>
                    </div>
                  </div>
                  
                  <div className="md:hidden flex absolute left-0 top-1/2 transform -translate-y-1/2 mt-0.5">
                    <div className={`w-8 h-8 rounded-full ${step.color} flex items-center justify-center z-10`}>
                      <span className="text-white font-bold text-sm">{index + 1}</span>
                    </div>
                  </div>
                  
                  <div className="md:w-1/2"></div>
                </div>
                
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute left-1/2 transform -translate-x-1/2 mt-4">
                    <ArrowRightIcon className="h-6 w-6 text-gray-400 rotate-90" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>

        {/* Contract Interactions */}
        <div className="mt-20">
          <motion.h3
            className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            Contract Interactions
          </motion.h3>
          
          <div className="grid gap-6 md:grid-cols-3">
            {interactions.map((interaction, index) => (
              <motion.div
                key={`${interaction.from}-${interaction.to}`}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.2 }}
              >
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-lg font-bold text-gray-900 dark:text-white">{interaction.from}</div>
                    <ArrowRightIcon className="h-5 w-5 text-gray-400" />
                    <div className="text-lg font-bold text-gray-900 dark:text-white">{interaction.to}</div>
                  </div>
                  
                  <div className="flex items-center mb-4">
                    <div className="p-2 rounded-full bg-gray-100 dark:bg-gray-700">
                      <interaction.icon className="h-6 w-6 text-blue-500" />
                    </div>
                  </div>
                  
                  <p className="text-gray-500 dark:text-gray-300">{interaction.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Circular Ecosystem Diagram */}
        <motion.div 
          className="mt-20 flex justify-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <div className="relative w-64 h-64 md:w-80 md:h-80">
            {/* Center Circle */}
            <div className="absolute inset-0 m-auto w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center z-10">
              <span className="text-gray-800 dark:text-white font-bold text-xs text-center">Sheep Ecosystem</span>
            </div>
            
            {/* Sheep Token */}
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center border-2 border-green-500">
              <span className="text-green-800 dark:text-green-200 font-bold text-xs text-center">Sheep Token</span>
            </div>
            
            {/* SheepDog */}
            <div className="absolute bottom-1/4 right-0 transform translate-x-1/2 w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center border-2 border-blue-500">
              <span className="text-blue-800 dark:text-blue-200 font-bold text-xs text-center">SheepDog</span>
            </div>
            
            {/* Wolf */}
            <div className="absolute bottom-1/4 left-0 transform -translate-x-1/2 w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center border-2 border-purple-500">
              <span className="text-purple-800 dark:text-purple-200 font-bold text-xs text-center">Wolf</span>
            </div>
            
            {/* Connection Lines */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 200">
              <path d="M100,40 L100,80" stroke="rgb(34, 197, 94)" strokeWidth="2" fill="none" />
              <path d="M150,120 L110,100" stroke="rgb(59, 130, 246)" strokeWidth="2" fill="none" />
              <path d="M50,120 L90,100" stroke="rgb(168, 85, 247)" strokeWidth="2" fill="none" />
              <path d="M50,120 C30,150 170,150 150,120" stroke="rgb(251, 191, 36)" strokeWidth="2" fill="none" />
            </svg>
          </div>
        </motion.div>
      </div>
    </div>
  );
} 