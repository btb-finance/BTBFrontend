'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowTrendingUpIcon,
  BanknotesIcon,
  BoltIcon,
  CheckCircleIcon,
  CurrencyDollarIcon,
  GlobeAltIcon,
  HandRaisedIcon,
  LockClosedIcon,
  MegaphoneIcon,
  PresentationChartLineIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TrophyIcon,
  UserGroupIcon,
  WalletIcon,
  XMarkIcon,
  PhoneIcon,
  EnvelopeIcon,
  ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline';
import { Button, MotionButton } from '@/app/components/ui/button';
import { Card, MotionCard, CardContent, CardTitle, CardDescription } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Alert } from '@/app/components/ui/alert';
import { useWallet } from '@/app/context/WalletContext';

// Key features of Aero Booster service
const aeroFeatures = [
  {
    title: 'Weekly Voting Power',
    description: 'Projects get guaranteed voting support for their liquidity pools for 1 week periods.',
    icon: HandRaisedIcon,
    color: 'from-blue-500 to-blue-700',
    highlight: true
  },
  {
    title: 'Locked AERO Holdings',
    description: 'BTB owns significant amounts of locked AERO tokens to maximize voting influence.',
    icon: LockClosedIcon,
    color: 'from-purple-500 to-indigo-600'
  },
  {
    title: 'Tiered Pricing Structure',
    description: 'Competitive rates: 5% for 1k AERO, 4% for 5k AERO, 2% for 10k+ AERO weekly fees.',
    icon: CurrencyDollarIcon,
    color: 'from-green-500 to-emerald-600',
    highlight: true
  },
  {
    title: 'LP Provider Rewards',
    description: 'Your liquidity providers receive weekly emissions boosted by our voting power.',
    icon: TrophyIcon,
    color: 'from-amber-500 to-orange-600'
  },
  {
    title: 'Multiple Contact Methods',
    description: 'Reach us easily via X (Twitter), Telegram, Discord, or email for quick service.',
    icon: ChatBubbleLeftRightIcon,
    color: 'from-cyan-500 to-sky-600'
  },
  {
    title: 'Transparent Service',
    description: 'Clear pricing, guaranteed delivery, and transparent voting allocation for all projects.',
    icon: ShieldCheckIcon,
    color: 'from-pink-500 to-rose-600',
    highlight: true
  }
];

// Contact methods
const contactMethods = [
  {
    name: 'X (Twitter)',
    handle: '@btb_finance',
    url: 'https://x.com/btb_finance',
    icon: () => (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
    color: 'hover:bg-gray-100 dark:hover:bg-gray-800'
  },
  {
    name: 'Telegram',
    handle: '@btbfinance',
    url: 'https://t.me/btbfinance',
    icon: () => (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="m20.665 3.717-17.73 6.837c-1.21.486-1.203 1.161-.222 1.462l4.552 1.42 10.532-6.645c.498-.303.953-.14.579.192l-8.533 7.701h-.002l.002.001-.314 4.692c.46 0 .663-.211.921-.46l2.211-2.15 4.599 3.397c.848.467 1.457.227 1.668-.785L24 5.555c.265-1.6-.578-2.306-1.335-1.838z"/>
      </svg>
    ),
    color: 'hover:bg-blue-50 dark:hover:bg-blue-900/20'
  },
  {
    name: 'Discord',
    handle: 'BTB Community',
    url: 'https://discord.com/invite/bqFEPA56Tc',
    icon: () => (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
      </svg>
    ),
    color: 'hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
  },
  {
    name: 'Email',
    handle: 'hello@btb.finance',
    url: 'mailto:hello@btb.finance',
    icon: EnvelopeIcon,
    color: 'hover:bg-green-50 dark:hover:bg-green-900/20'
  }
];

// Pricing tiers
const pricingTiers = [
  {
    amount: '1,000 AERO',
    aeroFee: '50 AERO',
    weeklyRate: '5%',
    description: 'Perfect for smaller projects getting started',
    features: ['1 week voting support', 'Basic LP emissions boost', 'Project promotion']
  },
  {
    amount: '5,000 AERO',
    aeroFee: '200 AERO',
    weeklyRate: '4%',
    description: 'Great value for medium-sized projects',
    features: ['1 week voting support', 'Enhanced LP emissions', 'Social media promotion', 'Priority support'],
    popular: true
  },
  {
    amount: '10,000+ AERO',
    aeroFee: '200+ AERO',
    weeklyRate: '2%',
    description: 'Best rates for large projects & protocols',
    features: ['1 week voting support', 'Maximum LP boost', 'Featured project status', 'Partnership opportunities']
  }
];

export default function AeroBoosterPage() {
  const { isConnected, address, connectWallet } = useWallet();
  const [showContactModal, setShowContactModal] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [requestedAmount, setRequestedAmount] = useState('');
  const [preferredContact, setPreferredContact] = useState('email');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitMessage('Request submitted successfully! We will contact you within 24 hours.');
      setShowContactModal(false);
      // Reset form
      setProjectName('');
      setContactEmail('');
      setProjectDescription('');
      setRequestedAmount('');
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-900 dark:to-blue-900/20">
      {/* Header Section */}
      <section className="relative pt-24 pb-12 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-cyan-600/10" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-medium mb-6">
              <SparklesIcon className="w-4 h-4 mr-2" />
              New Service Available
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
              <span className="block">Aero Booster</span>
              <span className="block text-gradient">Voting Service</span>
            </h1>
            
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">
              BTB owns locked AERO tokens and provides weekly voting support for your project's liquidity pools. 
              Tiered pricing: 5% for 1k AERO, 4% for 5k AERO, 2% for 10k+ AERO weekly fees.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <MotionButton
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowContactModal(true)}
                className="btn-primary px-8 py-4 text-lg"
              >
                Request Voting Support
                <MegaphoneIcon className="ml-2 w-5 h-5" />
              </MotionButton>
              
              <MotionButton
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                variant="outline"
                className="px-8 py-4 text-lg border-2"
              >
                Learn More
                <ArrowTrendingUpIcon className="ml-2 w-5 h-5" />
              </MotionButton>
            </div>
          </motion.div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 bg-white dark:bg-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              How Aero Booster Works
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Simple, transparent process to boost your project's liquidity incentives
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Contact Us',
                description: 'Reach out via X, Telegram, Discord, or email with your project details',
                icon: ChatBubbleLeftRightIcon
              },
              {
                step: '02', 
                title: 'Pay AERO Fee',
                description: 'Tiered rates: 5% for 1k, 4% for 5k, 2% for 10k+ AERO (scalable to any amount)',
                icon: CurrencyDollarIcon
              },
              {
                step: '03',
                title: 'Get Voting Support',
                description: 'We vote for your pools for 1 week, boosting LP provider rewards',
                icon: HandRaisedIcon
              }
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: index * 0.2 }}
                viewport={{ once: true }}
                className="relative"
              >
                <Card className="p-8 text-center hover-lift">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold text-xl mb-6">
                    {item.step}
                  </div>
                  <item.icon className="w-8 h-8 mx-auto mb-4 text-blue-600 dark:text-blue-400" />
                  <CardTitle className="text-xl mb-4">{item.title}</CardTitle>
                  <CardDescription className="text-gray-600 dark:text-gray-300">
                    {item.description}
                  </CardDescription>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Why Choose Aero Booster?
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Professional voting service with guaranteed results and transparent pricing
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {aeroFeatures.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <MotionCard
                  whileHover={{ y: -5 }}
                  className={`p-6 h-full border-2 transition-all duration-300 ${
                    feature.highlight ? 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/20' : ''
                  }`}
                >
                  <div className={`inline-flex p-3 rounded-lg bg-gradient-to-r ${feature.color} mb-4`}>
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>
                  <CardTitle className="text-xl mb-3">{feature.title}</CardTitle>
                  <CardDescription className="text-gray-600 dark:text-gray-300">
                    {feature.description}
                  </CardDescription>
                </MotionCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-16 bg-gray-50 dark:bg-gray-800/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Tiered Pricing Structure
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Lower rates for larger amounts - better value as you scale up
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {pricingTiers.map((tier, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: index * 0.2 }}
                viewport={{ once: true }}
              >
                <MotionCard
                  whileHover={{ y: -5 }}
                  className={`p-8 text-center relative ${
                    tier.popular ? 'border-2 border-blue-500 bg-blue-50/50 dark:bg-blue-900/20' : ''
                  }`}
                >
                  {tier.popular && (
                    <div className="mb-4">
                      <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-2 rounded-full text-sm font-bold inline-block">
                        Most Popular
                      </div>
                    </div>
                  )}
                  
                  <div className="mb-6">
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      {tier.amount}
                    </h3>
                    <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-1">
                      {tier.aeroFee}
                    </p>
                    <p className="text-lg font-semibold text-green-600 dark:text-green-400 mb-2">
                      {tier.weeklyRate} weekly fee
                    </p>
                    <p className="text-gray-600 dark:text-gray-300">
                      {tier.description}
                    </p>
                  </div>

                  <ul className="space-y-3 mb-8">
                    {tier.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-center">
                        <CheckCircleIcon className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" />
                        <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={() => setShowContactModal(true)}
                    className={`w-full ${tier.popular ? 'btn-primary' : 'btn-secondary'}`}
                  >
                    Get Started
                  </Button>
                </MotionCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Methods Section */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Get In Touch
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Choose your preferred way to contact us for Aero Booster services
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {contactMethods.map((method, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Link href={method.url} target="_blank" rel="noopener noreferrer">
                  <MotionCard
                    whileHover={{ y: -5, scale: 1.02 }}
                    className={`p-6 text-center cursor-pointer transition-all duration-300 ${method.color}`}
                  >
                    <div className="inline-flex p-3 rounded-lg bg-gray-100 dark:bg-gray-700 mb-4">
                      <method.icon className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                    </div>
                    <CardTitle className="text-lg mb-2">{method.name}</CardTitle>
                    <CardDescription className="text-gray-600 dark:text-gray-400">
                      {method.handle}
                    </CardDescription>
                  </MotionCard>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Modal */}
      <AnimatePresence>
        {showContactModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowContactModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-8 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Request Voting Support
                </h3>
                <button
                  onClick={() => setShowContactModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmitRequest} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Project Name
                  </label>
                  <Input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="Enter your project name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Contact Email
                  </label>
                  <Input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Requested Amount ($)
                  </label>
                  <Input
                    type="number"
                    value={requestedAmount}
                    onChange={(e) => setRequestedAmount(e.target.value)}
                    placeholder="e.g., 10000"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Project Description
                  </label>
                  <textarea
                    value={projectDescription}
                    onChange={(e) => setProjectDescription(e.target.value)}
                    placeholder="Brief description of your project and voting needs"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    rows={3}
                    required
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full btn-primary"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Request'}
                </Button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Message */}
      <AnimatePresence>
        {submitMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 right-6 z-50"
          >
            <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200">
              <CheckCircleIcon className="w-5 h-5" />
              <span>{submitMessage}</span>
              <button
                onClick={() => setSubmitMessage('')}
                className="ml-4 text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
} 