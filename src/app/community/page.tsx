'use client';

import { useState } from 'react';
import { ChatBubbleLeftIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

const categories = [
  {
    id: 'general',
    name: 'General Discussion',
    description: 'Share your DeFi journey and learn from the community',
    icon: ChatBubbleLeftIcon,
    topics: 234,
    posts: 1543
  },
  {
    id: 'strategies',
    name: 'Strategy Sharing',
    description: 'How I Turned $1k into $10k in a Month - Share your success stories',
    icon: null,
    topics: 156,
    posts: 892
  },
  {
    id: 'protocols',
    name: 'Protocol Reviews',
    description: 'Deep dive into the latest DeFi protocols and their potential',
    icon: null,
    topics: 89,
    posts: 445
  },
  {
    id: 'governance',
    name: 'Governance',
    description: 'Shape the future of btb.finance with your voice',
    icon: UserGroupIcon,
    topics: 67,
    posts: 234
  }
];

const recentTopics = [
  {
    id: 1,
    title: 'Best DeFi Projects for 2025?',
    author: 'yield_master',
    replies: 45,
    views: 289,
    lastActivity: '2h ago',
    category: 'strategies'
  },
  {
    id: 2,
    title: 'Advanced Techniques to Beat Impermanent Loss',
    author: 'defi_expert',
    replies: 67,
    views: 432,
    lastActivity: '4h ago',
    category: 'education'
  },
  {
    id: 3,
    title: 'Community Feature Request: Portfolio Analytics',
    author: 'btb_enthusiast',
    replies: 23,
    views: 156,
    lastActivity: '6h ago',
    category: 'governance'
  }
];

export default function CommunityPage() {
  const [activeCategory, setActiveCategory] = useState('general');

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Hero Section */}
      <div className="relative">
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]"></div>
        <div className="relative max-w-7xl mx-auto pt-24 pb-20 px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gradient sm:text-5xl md:text-6xl mb-6">
              Where DeFi Minds Meet
            </h1>
            <p className="mt-6 text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Join a community where every question is an opportunity to learn and every answer is a step towards mastery.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Categories */}
          <div className="lg:col-span-2 space-y-6">
            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gradient">Discussion Categories</h2>
                <button className="btn-primary">
                  New Topic
                </button>
              </div>
              <div className="grid gap-6">
                {categories.map((category) => {
                  const Icon = category.icon;
                  return (
                    <button
                      key={category.id}
                      onClick={() => setActiveCategory(category.id)}
                      className={`p-6 rounded-xl transition-all duration-300 text-left ${
                        activeCategory === category.id
                          ? 'bg-btb-gradient text-white'
                          : 'bg-white dark:bg-gray-800 hover:shadow-lg'
                      }`}
                    >
                      <div className="flex items-start">
                        {Icon && <Icon className="h-8 w-8 mr-4 text-[#FF0420]" />}
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold mb-2">{category.name}</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{category.description}</p>
                          <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 space-x-4">
                            <span>{category.topics} topics</span>
                            <span>{category.posts} posts</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Recent Activity */}
            <div className="card bg-btb-gradient text-white">
              <h2 className="text-xl font-bold mb-4">Trending Discussions</h2>
              <div className="space-y-4">
                {recentTopics.map((topic) => (
                  <div key={topic.id} className="p-4 bg-white/10 rounded-lg hover:bg-white/20 transition-colors">
                    <h3 className="font-medium mb-2">{topic.title}</h3>
                    <div className="flex items-center justify-between text-sm text-white/80">
                      <span className="flex items-center">
                        <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                        {topic.author}
                      </span>
                      <span>{topic.lastActivity}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Community Stats */}
            <div className="card">
              <h2 className="text-xl font-bold text-gradient mb-4">Community Stats</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-white dark:bg-gray-800 rounded-lg">
                  <div className="text-2xl font-bold text-[#FF0420]">12.5K+</div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">Members</div>
                </div>
                <div className="text-center p-4 bg-white dark:bg-gray-800 rounded-lg">
                  <div className="text-2xl font-bold text-[#FF0420]">45K+</div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">Posts</div>
                </div>
              </div>
            </div>

            {/* Join Discord */}
            <Link 
              href="https://discord.gg/btbfinance" 
              target="_blank"
              className="card bg-[#5865F2] text-white hover:bg-[#4752C4] transition-colors block text-center"
            >
              <h2 className="text-xl font-bold mb-2">Join Our Discord</h2>
              <p className="text-white/80">Get real-time updates and chat with the community</p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
