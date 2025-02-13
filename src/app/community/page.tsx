'use client';

import { useState } from 'react';
import { ChatBubbleLeftIcon, UserGroupIcon } from '@heroicons/react/24/outline';

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
    <div className="min-h-screen bg-gradient-to-br from-[#1976D2] via-blue-800 to-[#1976D2]">
      {/* Hero Section */}
      <div className="relative">
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-20"></div>
        <div className="relative max-w-7xl mx-auto pt-24 pb-20 px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold font-montserrat text-white sm:text-5xl md:text-6xl">
              Where DeFi Minds Meet
            </h1>
            <p className="mt-6 text-xl text-blue-100 max-w-3xl mx-auto font-roboto">
              Join a community where every question is an opportunity to learn and every answer is a step towards mastery.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Categories */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-montserrat font-bold text-white">Discussion Categories</h2>
                <button className="px-4 py-2 bg-[#4CAF50] text-white rounded-lg font-medium hover:bg-[#45a049] transition-colors">
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
                          ? 'bg-[#1976D2] text-white ring-2 ring-blue-400'
                          : 'bg-white/5 text-white hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-start">
                        {Icon && <Icon className="h-8 w-8 mr-4 text-[#FFD700]" />}
                        <div className="flex-1">
                          <h3 className="text-lg font-montserrat font-semibold mb-2">{category.name}</h3>
                          <p className="text-sm font-roboto text-blue-100 mb-4">{category.description}</p>
                          <div className="flex items-center text-sm text-blue-200 space-x-4">
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
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6">
              <h2 className="text-xl font-montserrat font-bold text-white mb-4">Trending Discussions</h2>
              <div className="space-y-4">
                {recentTopics.map((topic) => (
                  <div key={topic.id} className="p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
                    <h3 className="text-white font-medium mb-2">{topic.title}</h3>
                    <div className="flex items-center justify-between text-sm text-blue-200">
                      <span className="flex items-center">
                        <span className="w-2 h-2 bg-[#4CAF50] rounded-full mr-2"></span>
                        {topic.author}
                      </span>
                      <span>{topic.lastActivity}</span>
                    </div>
                    <div className="flex items-center mt-2 text-sm text-blue-300 space-x-4">
                      <span>{topic.replies} replies</span>
                      <span>{topic.views} views</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Community Stats */}
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6">
              <h2 className="text-xl font-montserrat font-bold text-white mb-4">Community Stats</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-white/5 rounded-lg text-center">
                  <div className="text-2xl font-bold text-[#FFD700]">2.5K</div>
                  <div className="text-sm text-blue-200">Members</div>
                </div>
                <div className="p-4 bg-white/5 rounded-lg text-center">
                  <div className="text-2xl font-bold text-[#4CAF50]">150</div>
                  <div className="text-sm text-blue-200">Online</div>
                </div>
                <div className="p-4 bg-white/5 rounded-lg text-center">
                  <div className="text-2xl font-bold text-[#FFD700]">5.2K</div>
                  <div className="text-sm text-blue-200">Topics</div>
                </div>
                <div className="p-4 bg-white/5 rounded-lg text-center">
                  <div className="text-2xl font-bold text-[#4CAF50]">25.6K</div>
                  <div className="text-sm text-blue-200">Posts</div>
                </div>
              </div>
            </div>

            {/* Join Discord */}
            <div className="bg-gradient-to-br from-[#1976D2] to-blue-700 rounded-xl p-6">
              <h2 className="text-xl font-montserrat font-bold text-white mb-4">Join Our Discord</h2>
              <p className="text-blue-100 mb-6 font-roboto">Stay connected, stay informed, stay ahead with our vibrant Discord community</p>
              <button className="w-full bg-white text-[#1976D2] rounded-lg px-4 py-3 font-medium hover:bg-blue-50 transition-colors">
                Join Discord Server
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
