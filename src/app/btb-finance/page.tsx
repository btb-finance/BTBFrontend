'use client';

import { Card, CardContent } from '../components/ui/card';
import { Sparkles, Rocket, Lock, TrendingUp } from 'lucide-react';

export default function BTBFinanceComingSoon() {
  return (
    <div className="container mx-auto px-4 py-8 min-h-screen flex items-center justify-center">
      <div className="max-w-4xl mx-auto w-full">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 mb-6 animate-pulse">
            <Sparkles className="w-10 h-10 text-white" />
          </div>

          <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-600 bg-clip-text text-transparent">
            Building Something Amazing
          </h1>

          <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-400 mb-6">
            We're crafting the BTB Token you'll love
          </p>

          <p className="text-lg text-gray-500 dark:text-gray-500 max-w-2xl mx-auto">
            Our team is working hard to bring you innovative DeFi features and experiences.
            Stay tuned for something extraordinary.
          </p>
        </div>

        {/* Feature Teasers */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Card className="border-2 border-purple-200 dark:border-purple-900/50 hover:shadow-xl transition-all">
            <CardContent className="p-6 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 mb-4">
                <Rocket className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Innovative Features</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Next-generation DeFi capabilities designed for the future
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 border-blue-200 dark:border-blue-900/50 hover:shadow-xl transition-all">
            <CardContent className="p-6 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-4">
                <Lock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Secure & Reliable</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Built with security and user trust as our top priorities
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 border-cyan-200 dark:border-cyan-900/50 hover:shadow-xl transition-all">
            <CardContent className="p-6 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-cyan-100 dark:bg-cyan-900/30 mb-4">
                <TrendingUp className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Growth Focused</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Designed to maximize value for our community
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Status Banner */}
        <Card className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 border-2 border-purple-200 dark:border-purple-800/50">
          <CardContent className="p-8 text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="relative">
                <div className="w-3 h-3 bg-purple-500 rounded-full animate-ping absolute"></div>
                <div className="w-3 h-3 bg-purple-600 rounded-full"></div>
              </div>
              <p className="text-sm font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wide">
                Development in Progress
              </p>
            </div>

            <h2 className="text-2xl font-bold mb-3 text-gray-900 dark:text-gray-100">
              The Wait Will Be Worth It
            </h2>

            <p className="text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
              We're reimagining DeFi with fresh ideas and powerful features.
              The BTB Token experience is being crafted with care to deliver something truly special.
            </p>
          </CardContent>
        </Card>

        {/* Footer Note */}
        <div className="text-center mt-12">
          <p className="text-sm text-gray-500 dark:text-gray-600">
            Questions or feedback? Stay connected with our community for updates.
          </p>
        </div>
      </div>
    </div>
  );
}
