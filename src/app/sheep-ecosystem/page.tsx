'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  ShieldCheckIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  BeakerIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import Image from 'next/image';
import Link from 'next/link';
import { Button, MotionButton } from '../components/ui/button';
import { Card, MotionCard, CardContent, CardTitle, CardDescription } from '../components/ui/card';
import EcosystemInfo from '../components/sheep-ecosystem/EcosystemInfo';
import EcosystemOverview from '../components/sheep-ecosystem/EcosystemOverview';

// Contract Addresses
const SHEEP_CONTRACT = '0x7bf26dF0E9Db4F70f286c39A9cd3A77Cb7407aa4';
const SHEEPDOG_CONTRACT = '0xa3b5f40a5719208B507F658a11Fb314Ef5e2c0e2';
const WOLF_CONTRACT = '0xf1152a195B93d51457633F96B81B1CF95a96E7A7';
const NETWORK = 'sonic';

const SHEEP_ECOSYSTEM_COMPONENTS = [
  {
    name: 'Sheep Token',
    description: 'The core token of our ecosystem, featuring deflationary mechanics and staking rewards.',
    detailedDescription: 'The Sheep token represents the foundation of our ecosystem with unique tokenomics designed to reward holders and maintain a stable economic environment.',
    features: ['Deflationary mechanics', 'Staking rewards', 'Governance voting', 'Ecosystem utility'],
    icon: CurrencyDollarIcon,
    contract: SHEEP_CONTRACT,
    bgColor: 'bg-gradient-to-br from-green-600/10 to-green-800/10',
    iconColor: 'text-green-600 dark:text-green-400',
    borderColor: 'border-green-200 dark:border-green-800'
  },
  {
    name: 'SheepDog Contract',
    description: 'The protector of the ecosystem providing security and stability to Sheep holders.',
    detailedDescription: 'SheepDog acts as the security layer for our ecosystem, providing protection mechanisms and ensuring the stability of Sheep tokens against market volatility.',
    features: ['Security mechanisms', 'Anti-dump protection', 'Market stabilization', 'Flash loan attack prevention'],
    icon: ShieldCheckIcon,
    contract: SHEEPDOG_CONTRACT,
    bgColor: 'bg-gradient-to-br from-blue-600/10 to-blue-800/10',
    iconColor: 'text-blue-600 dark:text-blue-400',
    borderColor: 'border-blue-200 dark:border-blue-800'
  },
  {
    name: 'Wolf Contract',
    description: 'The challenging force in the ecosystem that creates dynamic tokenomics and gameplay mechanics.',
    detailedDescription: 'Wolf introduces competitive elements to the ecosystem, creating opportunities for strategic gameplay and additional reward mechanisms for Sheep holders.',
    features: ['Competitive mechanics', 'Enhanced yield opportunities', 'Strategic gameplay', 'Ecosystem balance'],
    icon: BeakerIcon,
    contract: WOLF_CONTRACT,
    bgColor: 'bg-gradient-to-br from-purple-600/10 to-indigo-800/10',
    iconColor: 'text-purple-600 dark:text-purple-400',
    borderColor: 'border-purple-200 dark:border-purple-800'
  },
  {
    name: 'Sheep Ecosystem Community',
    description: 'Join our vibrant community of Sheep ecosystem participants and supporters.',
    detailedDescription: 'Be part of a thriving community that shares insights, strategies, and opportunities within the Sheep ecosystem.',
    features: ['Community governance', 'Shared strategies', 'Social events', 'Educational resources'],
    icon: UserGroupIcon,
    href: '/community',
    bgColor: 'bg-gradient-to-br from-amber-600/10 to-amber-800/10',
    iconColor: 'text-amber-600 dark:text-amber-400',
    borderColor: 'border-amber-200 dark:border-amber-800'
  }
];

const benefits = [
  {
    title: "Sheep Token Holders",
    benefits: [
      "Trade tokens on DEXs",
      "Earn rewards through staking",
      "Risk of being eaten by Wolf",
      "2% transaction fee on trades"
    ],
    icon: CurrencyDollarIcon,
    color: "bg-green-50 dark:bg-green-900/20"
  },
  {
    title: "SheepDog Holders",
    benefits: [
      "Protect your Sheep from Wolf",
      "Maintain a protective barrier",
      "Immune to Wolf's hunger",
      "5% team fee on purchases"
    ],
    icon: ShieldCheckIcon,
    color: "bg-blue-50 dark:bg-blue-900/20"
  },
  {
    title: "Wolf Mechanics",
    benefits: [
      "Hunger level increases over time",
      "Consumes unprotected Sheep tokens",
      "3% fee collected on consumption",
      "Each Wolf NFT has its own hunger"
    ],
    icon: SparklesIcon,
    color: "bg-purple-50 dark:bg-purple-900/20"
  }
];

const stats = [
  { label: 'Wolf Hunger Level', value: '68%' },
  { label: 'Protected Sheep', value: '7.2M+' },
  { label: 'Consumption Fee', value: '3%' },
  { label: 'Transaction Fee', value: '2%' }
];

export default function SheepEcosystem() {
  return (
    <div className="flex flex-col min-h-screen">
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
      
      {/* Hero Section */}
      <section className="relative py-16 overflow-hidden bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center">
            <motion.h1 
              className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl bg-clip-text text-transparent bg-gradient-to-r from-green-600 to-blue-600 dark:from-green-400 dark:to-blue-400"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              Sheep Ecosystem
            </motion.h1>
            <motion.p 
              className="mt-6 max-w-2xl mx-auto text-xl text-gray-500 dark:text-gray-300"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              Explore our predator-prey ecosystem where Wolf hunts unprotected Sheep, 
              and SheepDog provides a protective barrier against Wolf's hunger.
            </motion.p>
            <motion.div
              className="mt-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Link href="/sheep-ecosystem/interact">
                <Button size="lg" className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 text-lg">
                  Go to Interactive Tools
                </Button>
              </Link>
            </motion.div>
          </div>
        </div>
        {/* Background decorative elements */}
        <div className="absolute top-0 left-0 right-0 h-48 bg-gradient-to-b from-gray-50 to-transparent dark:from-gray-900 dark:to-transparent z-0"></div>
      </section>

      {/* Ecosystem Info Section */}
      <section className="bg-white dark:bg-gray-800">
        <EcosystemInfo />
      </section>

      {/* Ecosystem Overview Section */}
      <section className="bg-gray-50 dark:bg-gray-900">
        <EcosystemOverview />
      </section>

      {/* Stats Section */}
      <section className="bg-gray-50 dark:bg-gray-900 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <dl className="grid grid-cols-1 gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat, index) => (
              <motion.div 
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="bg-white dark:bg-gray-800 px-6 py-8 rounded-lg shadow-sm"
              >
                <dt className="text-base font-medium text-gray-500 dark:text-gray-300 text-center">
                  {stat.label}
                </dt>
                <dd className="mt-3 text-3xl font-extrabold text-green-600 dark:text-green-400 text-center">
                  {stat.value}
                </dd>
              </motion.div>
            ))}
          </dl>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white sm:text-4xl">
              Benefits for Everyone
            </h2>
            <p className="mt-4 max-w-2xl mx-auto text-xl text-gray-500 dark:text-gray-300">
              Each participant in the Sheep ecosystem enjoys unique benefits.
            </p>
          </div>

          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {benefits.map((group, index) => (
              <motion.div
                key={group.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className={`rounded-xl p-8 ${group.color}`}
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-md bg-white text-gray-900 mb-4">
                  <group.icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">{group.title}</h3>
                <ul className="mt-4 space-y-3">
                  {group.benefits.map((benefit, idx) => (
                    <li key={idx} className="flex">
                      <svg className="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="ml-3 text-gray-700 dark:text-gray-300">{benefit}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
} 