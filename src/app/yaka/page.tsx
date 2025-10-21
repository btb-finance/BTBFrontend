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
    title: 'Auto-Vote Each Week',
    description: 'We vote for you every epoch - no need to manually vote each week on which pools get emissions',
    icon: CheckCircleIcon,
    color: 'from-blue-500 to-blue-700'
  },
  {
    title: 'Maximize Your Fees',
    description: 'Our algorithm checks which pools offer the best fees and bribes, voting optimally to maximize your returns',
    icon: CurrencyDollarIcon,
    color: 'from-green-500 to-green-700'
  },
  {
    title: 'Set & Forget',
    description: 'Lock your tokens once, and we handle all weekly voting strategy - completely hands-free earning',
    icon: BoltIcon,
    color: 'from-purple-500 to-purple-700'
  },
  {
    title: 'Easy LP & Zaps',
    description: 'Add liquidity, zap into pools, and execute swaps - all Yaka features in one simple interface',
    icon: RocketLaunchIcon,
    color: 'from-orange-500 to-orange-700'
  },
  {
    title: 'Track Your Rewards',
    description: 'See your voting fees, bribes, and emissions in real-time with detailed analytics',
    icon: ChartBarIcon,
    color: 'from-pink-500 to-pink-700'
  },
  {
    title: 'Non-Custodial',
    description: 'Your tokens stay in your wallet - we just vote on your behalf, you keep full control',
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
              We vote on the best pools for you every week so you earn maximum fees and bribes.
              Plus, easy swaps, LP management, and zaps - all in one place.
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
                { label: 'Auto-Vote Weekly', value: '100%' },
                { label: 'No Manual Work', value: '0%' },
                { label: 'Max Rewards', value: 'Always' }
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
              Yaka Finance requires weekly voting to earn fees. We automate it and pick the best pools for maximum returns.
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
              Stop Manually Voting Every Week
            </h2>
            <p className="text-xl mb-12 max-w-3xl mx-auto opacity-90">
              Most users forget to vote weekly and miss out on fees. We ensure you always vote on the best pools.
            </p>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { title: 'Weekly Automation', desc: 'We vote every epoch so you never miss rewards' },
                { title: 'Best Pool Selection', desc: 'Algorithm picks pools with highest fees & bribes' },
                { title: 'Better Interface', desc: 'Cleaner, faster Yaka experience for all features' },
                { title: 'Real-Time Earnings', desc: 'Track your voting fees and rewards live' }
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
              Be the First to Experience It
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
              Get notified when we launch and receive exclusive early access
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
