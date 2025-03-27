 'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  ShieldCheckIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  BeakerIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import ContractCard from './ContractCard';

// Contract Addresses
const SHEEP_CONTRACT = '0x7bf26dF0E9Db4F70f286c39A9cd3A77Cb7407aa4';
const SHEEPDOG_CONTRACT = '0xa3b5f40a5719208B507F658a11Fb314Ef5e2c0e2';
const WOLF_CONTRACT = '0xf1152a195B93d51457633F96B81B1CF95a96E7A7';
const NETWORK = 'sonic';

const SHEEP_ECOSYSTEM_COMPONENTS = [
  {
    name: 'Sheep Token',
    description: 'The tradable token that users can buy, stake, and trade within the ecosystem with a 2% transaction fee.',
    features: ['Buyable on DEXs', 'Can be eaten by Wolf if unprotected', '2% transaction fee', 'Stakable for rewards'],
    icon: CurrencyDollarIcon,
    contractAddress: SHEEP_CONTRACT,
    network: NETWORK,
    bgColor: 'bg-gradient-to-br from-green-600/10 to-green-800/10',
    iconColor: 'text-green-600 dark:text-green-400',
    borderColor: 'border-green-200 dark:border-green-800'
  },
  {
    name: 'SheepDog Contract',
    description: 'Protects holders from Wolf by placing a barrier that prevents Wolf from eating Sheep tokens. Includes a 5% team fee on purchases.',
    features: ['Shields Sheep holders at 1:100 ratio', 'Active protection mechanism', '5% team fee on purchases', 'Complete immunity to Wolf'],
    icon: ShieldCheckIcon,
    contractAddress: SHEEPDOG_CONTRACT,
    network: NETWORK,
    bgColor: 'bg-gradient-to-br from-blue-600/10 to-blue-800/10',
    iconColor: 'text-blue-600 dark:text-blue-400',
    borderColor: 'border-blue-200 dark:border-blue-800'
  },
  {
    name: 'Wolf Contract',
    description: 'Each Wolf NFT has its own hunger level that increases with each feeding. Consumes unprotected Sheep tokens with a 3% fee.',
    features: ['Consumes unprotected Sheep', 'Individual NFT hunger levels', '3% fee on consumption', 'Hunger increases with each feeding'],
    icon: BeakerIcon,
    contractAddress: WOLF_CONTRACT,
    network: NETWORK,
    bgColor: 'bg-gradient-to-br from-purple-600/10 to-indigo-800/10',
    iconColor: 'text-purple-600 dark:text-purple-400',
    borderColor: 'border-purple-200 dark:border-purple-800'
  }
];

interface EcosystemInfoProps {
  className?: string;
}

export default function EcosystemInfo({ className = '' }: EcosystemInfoProps) {
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
            Sheep Ecosystem Contracts
          </motion.h2>
          <motion.p 
            className="mt-4 max-w-2xl mx-auto text-xl text-gray-500 dark:text-gray-300"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            Our ecosystem consists of three main contracts working together to create a balanced environment.
          </motion.p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {SHEEP_ECOSYSTEM_COMPONENTS.map((component, index) => (
            <ContractCard 
              key={component.name}
              name={component.name}
              description={component.description}
              contractAddress={component.contractAddress}
              network={component.network}
              icon={component.icon}
              delay={index * 0.1}
              bgColor={component.bgColor}
              iconColor={component.iconColor}
              borderColor={component.borderColor}
              features={component.features}
            />
          ))}
        </div>
      </div>
    </div>
  );
} 