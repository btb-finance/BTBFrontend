'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  BeakerIcon,
  CubeTransparentIcon,
  SparklesIcon,
  HeartIcon,
  UsersIcon,
  GiftIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardTitle, CardDescription } from '../components/ui/card';

export default function CustomGameCreation() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Hero Section */}
      <section className="relative py-20">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 to-indigo-600/10" />
        <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <div className="flex justify-center mb-6">
              <div className="p-4 rounded-full bg-purple-100 dark:bg-purple-900/30">
                <BeakerIcon className="h-12 w-12 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              <span className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 bg-clip-text text-transparent">
                Custom Game Creation
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-8 max-w-4xl mx-auto">
              Launch your own Hunt-to-Earn game ecosystem like BTB Game. We build complete tokenomics, deflationary mechanics, and LP reward systems tailored to your vision.
            </p>

            <div className="flex items-center justify-center gap-3 mb-8">
              <GiftIcon className="h-8 w-8 text-green-500" />
              <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                100% FREE SERVICE
              </span>
              <GiftIcon className="h-8 w-8 text-green-500" />
            </div>

            <div className="flex items-center justify-center gap-3 mb-12">
              <HeartIcon className="h-6 w-6 text-red-500" />
              <span className="text-lg text-gray-700 dark:text-gray-300">
                We love working with teams and don't charge any money for integrations!
              </span>
              <HeartIcon className="h-6 w-6 text-red-500" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              What We Build For You
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Complete gaming ecosystems with sophisticated tokenomics
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                title: "Custom Tokenomics Design",
                description: "Sophisticated multi-token price pressure systems that ensure sustainable growth",
                icon: CubeTransparentIcon,
                color: "from-blue-500 to-cyan-500"
              },
              {
                title: "NFT Integration Systems", 
                description: "Complete NFT mechanics with scarcity, redemption, and reward systems",
                icon: SparklesIcon,
                color: "from-purple-500 to-pink-500"
              },
              {
                title: "Deflationary Mechanics",
                description: "Token burning, supply reduction, and upward price pressure mechanisms",
                icon: SparklesIcon,
                color: "from-orange-500 to-red-500"
              },
              {
                title: "Multi-Network Deployment",
                description: "Deploy across any blockchain network with full compatibility",
                icon: UsersIcon,
                color: "from-green-500 to-emerald-500"
              },
              {
                title: "Smart Contract Development",
                description: "Fully audited smart contracts with security and efficiency built-in",
                icon: BeakerIcon,
                color: "from-indigo-500 to-purple-500"
              },
              {
                title: "Frontend Development",
                description: "Beautiful, responsive game interfaces optimized for all devices",
                icon: SparklesIcon,
                color: "from-teal-500 to-blue-500"
              }
            ].map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.3 + index * 0.1 }}
              >
                <Card className="h-full hover:shadow-xl transition-all duration-300 border-2 border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600">
                  <CardContent className="p-6">
                    <div className={`p-3 rounded-full bg-gradient-to-r ${feature.color} w-fit mb-4`}>
                      <feature.icon className="h-6 w-6 text-white" />
                    </div>
                    <CardTitle className="text-xl mb-3">{feature.title}</CardTitle>
                    <CardDescription className="text-gray-600 dark:text-gray-300">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section className="py-16 bg-white/50 dark:bg-gray-800/50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              How We Work With Your Team
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              From concept to deployment - completely free!
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              {
                step: "1",
                title: "Share Your Idea",
                description: "Contact us via X, Telegram, or email with your game concept"
              },
              {
                step: "2", 
                title: "Design Together",
                description: "We collaborate with your team to design the perfect tokenomics and mechanics"
              },
              {
                step: "3",
                title: "We Build Everything",
                description: "Smart contracts, frontend, backend - we handle all development at no cost"
              },
              {
                step: "4",
                title: "Launch & Support", 
                description: "Deploy your game and receive ongoing support from our team"
              }
            ].map((step, index) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 + index * 0.1 }}
                className="text-center"
              >
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 flex items-center justify-center text-white text-2xl font-bold">
                  {step.step}
                </div>
                <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                <p className="text-gray-600 dark:text-gray-300">{step.description}</p>
                {index < 3 && (
                  <ArrowRightIcon className="h-6 w-6 text-purple-400 mx-auto mt-4 hidden md:block" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-purple-600 to-indigo-600">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
              Ready to Build Your Game?
            </h2>
            <p className="text-xl text-purple-100 mb-8">
              Contact our team today and let's create something amazing together - completely free!
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
              {[
                { platform: "X (Twitter)", contact: "@btb_finance" },
                { platform: "Telegram", contact: "t.me/btbfinance" },
                { platform: "Email", contact: "hello@btb.finance" }
              ].map((method, index) => (
                <motion.div
                  key={method.platform}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.2 + index * 0.1 }}
                  className="bg-white/10 backdrop-blur-sm rounded-lg p-4 hover:bg-white/20 transition-all cursor-pointer"
                >
                  <div className="text-white font-semibold">{method.platform}</div>
                  <div className="text-purple-100 text-sm">{method.contact}</div>
                </motion.div>
              ))}
            </div>

            <div className="flex items-center justify-center gap-3">
              <HeartIcon className="h-8 w-8 text-red-300" />
              <span className="text-2xl font-bold text-white">
                We Love Working With Teams!
              </span>
              <HeartIcon className="h-8 w-8 text-red-300" />
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}