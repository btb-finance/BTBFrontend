'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, MotionButton } from '@/app/components/ui/button';
import { Card, MotionCard } from '@/app/components/ui/card';
import {
  SparklesIcon,
  RocketLaunchIcon,
  CurrencyDollarIcon,
  BoltIcon,
  ShieldCheckIcon,
  ChartBarIcon,
  CheckCircleIcon,
  BellAlertIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

const features = [
  {
    title: 'Never Miss a Week',
    description: 'Forgot to vote this week? You just lost all rewards. We vote automatically so you NEVER miss earnings',
    icon: CheckCircleIcon,
    color: 'from-blue-500 to-blue-700'
  },
  {
    title: 'Last Minute Voting',
    description: 'We vote at the deadline when APRs are final - ensuring you always get the highest returns possible',
    icon: CurrencyDollarIcon,
    color: 'from-green-500 to-green-700'
  },
  {
    title: 'Stop Wasting Time',
    description: 'No more checking pools every week. No spreadsheets. No stress. Just set it once and earn passively',
    icon: BoltIcon,
    color: 'from-purple-500 to-purple-700'
  },
  {
    title: 'Always Best Pools',
    description: 'Voted on a low-APR pool? You missed out. Our algorithm picks the pools with maximum fees & bribes',
    icon: RocketLaunchIcon,
    color: 'from-orange-500 to-orange-700'
  },
  {
    title: 'Complete Yaka Suite',
    description: 'Swaps, LP management, zaps - everything Yaka offers in one clean, fast interface',
    icon: ChartBarIcon,
    color: 'from-pink-500 to-pink-700'
  },
  {
    title: 'Your Keys, Your Coins',
    description: 'Non-custodial - we only vote on your behalf, your funds never leave your wallet',
    icon: ShieldCheckIcon,
    color: 'from-cyan-500 to-cyan-700'
  }
];

const roadmapSteps = [
  {
    phase: 'Phase 1',
    title: 'Auto-Voting Engine',
    description: 'Weekly automated voting on highest-fee pools with optimal strategy',
    status: 'In Development'
  },
  {
    phase: 'Phase 2',
    title: 'Complete Yaka Interface',
    description: 'Add swaps, LP management, and zaps with better UX than native',
    status: 'Planned'
  },
  {
    phase: 'Phase 3',
    title: 'Advanced Analytics',
    description: 'Track voting performance, fee earnings, and historical returns',
    status: 'Planned'
  }
];

export default function YakaPage() {
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [email, setEmail] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const handleNotifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowNotifyModal(false);
    setShowSuccess(true);
    setEmail('');
    setTimeout(() => setShowSuccess(false), 5000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-900 dark:to-slate-900">
      {/* Hero Section */}
      <section className="relative pt-24 pb-12 overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/10 dark:bg-purple-500/5 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/10 dark:bg-blue-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            {/* Coming Soon Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="inline-flex items-center px-4 py-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold mb-6 shadow-lg"
            >
              <SparklesIcon className="w-5 h-5 mr-2" />
              Coming Soon
            </motion.div>

            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
              Automated Yaka Voting
              <br />
              <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Maximize Your Rewards
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto leading-relaxed">
              Managing votes every week is exhausting. Miss a week? You lose all rewards. Vote on the wrong pool? You earn less.
              We vote last minute on the highest APR pools automatically - you never miss rewards again.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <MotionButton
                onClick={() => setShowNotifyModal(true)}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-4 text-lg rounded-xl shadow-xl"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <BellAlertIcon className="w-5 h-5 mr-2 inline" />
                Notify Me at Launch
              </MotionButton>

              <MotionButton
                variant="outline"
                className="px-8 py-4 text-lg rounded-xl border-2 border-gray-300 dark:border-gray-600"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Learn More
              </MotionButton>
            </div>

            {/* Stats Preview */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 max-w-4xl mx-auto"
            >
              {[
                { label: 'Never Miss Rewards', value: '100%' },
                { label: 'Manual Effort', value: '0%' },
                { label: 'Best APR Pools', value: 'Always' }
              ].map((stat, index) => (
                <MotionCard
                  key={index}
                  className="p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm"
                  whileHover={{ y: -5 }}
                >
                  <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                    {stat.value}
                  </div>
                  <div className="text-gray-600 dark:text-gray-400">{stat.label}</div>
                </MotionCard>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
              How Auto-Voting Works
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Simple setup, maximum earnings - let us handle the weekly grind
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '1',
                title: 'Connect & Delegate',
                description: 'Connect your wallet and enable auto-voting once. That\'s it - no weekly management needed.',
                gradient: 'from-blue-500 to-blue-700'
              },
              {
                step: '2',
                title: 'We Track Pool APRs',
                description: 'Our algorithm monitors all Yaka pools in real-time, tracking fees, bribes, and APR changes.',
                gradient: 'from-purple-500 to-purple-700'
              },
              {
                step: '3',
                title: 'Last-Minute Optimal Vote',
                description: 'Right before the epoch deadline, we vote on the highest-paying pools. You get maximum rewards, every week.',
                gradient: 'from-green-500 to-green-700'
              }
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: index * 0.2 }}
                viewport={{ once: true }}
              >
                <MotionCard
                  className="p-8 h-full bg-white dark:bg-gray-800 relative overflow-hidden"
                  whileHover={{ y: -5 }}
                >
                  <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${item.gradient} opacity-10 rounded-full -mr-16 -mt-16`}></div>
                  <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r ${item.gradient} text-white text-2xl font-bold mb-6`}>
                    {item.step}
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                    {item.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 text-lg leading-relaxed">
                    {item.description}
                  </p>
                </MotionCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* What We're Building Section */}
      <section className="py-16 bg-white/50 dark:bg-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
              Never Miss Optimal Votes Again
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Yaka Finance requires weekly voting to earn fees. Miss a week? Zero rewards. Vote on wrong pools? Lower earnings. We solve both problems.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <MotionCard
                  className="p-6 h-full bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700"
                  whileHover={{ y: -5, borderColor: 'rgb(147, 51, 234)' }}
                >
                  <div className={`inline-flex p-3 rounded-lg bg-gradient-to-r ${feature.color} mb-4 shadow-lg`}>
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                    {feature.description}
                  </p>
                </MotionCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Roadmap Section */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
              Development Roadmap
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              From automated voting to complete Yaka Finance interface - all in one place
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {roadmapSteps.map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: index * 0.2 }}
                viewport={{ once: true }}
              >
                <MotionCard
                  className="p-8 h-full bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 border-2 border-gray-200 dark:border-gray-700"
                  whileHover={{ scale: 1.05 }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-bold text-purple-600 dark:text-purple-400">
                      {step.phase}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      step.status === 'In Development'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      {step.status}
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                    {step.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    {step.description}
                  </p>
                </MotionCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Better Section */}
      <section className="py-16 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              The Problem With Manual Voting
            </h2>
            <p className="text-xl mb-12 max-w-3xl mx-auto opacity-90">
              Miss one week? Zero rewards. Vote early? Pools change and you earn less. It's exhausting and costly.
            </p>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { title: 'Miss Week = $0', desc: 'Forgot to vote? You earned nothing that epoch' },
                { title: 'Wrong Pool = Less $', desc: 'Pool APR dropped after you voted? You lost money' },
                { title: 'Last Minute Edge', desc: 'We vote at deadline with final APR data' },
                { title: 'Set Once, Earn Forever', desc: 'Enable auto-voting and never think about it again' }
              ].map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="bg-white/10 backdrop-blur-sm rounded-xl p-6"
                >
                  <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                  <p className="opacity-90">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-6">
              Stop Missing Rewards Every Week
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
              Join the waitlist for automatic voting that earns you maximum fees and bribes - every single epoch
            </p>
            <MotionButton
              onClick={() => setShowNotifyModal(true)}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-12 py-6 text-xl rounded-xl shadow-2xl"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <BellAlertIcon className="w-6 h-6 mr-2 inline" />
              Notify Me at Launch
            </MotionButton>
          </motion.div>
        </div>
      </section>

      {/* Notify Modal */}
      <AnimatePresence>
        {showNotifyModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowNotifyModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    Get Early Access
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    Be notified when we launch
                  </p>
                </div>
                <button
                  onClick={() => setShowNotifyModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleNotifySubmit}>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-purple-500 focus:outline-none transition-colors"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-4 rounded-lg font-semibold shadow-lg"
                >
                  Notify Me
                </Button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Alert */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 right-8 bg-green-500 text-white px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 z-50"
          >
            <CheckCircleIcon className="w-6 h-6" />
            <div>
              <div className="font-semibold">Success!</div>
              <div className="text-sm opacity-90">We'll notify you at launch</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
