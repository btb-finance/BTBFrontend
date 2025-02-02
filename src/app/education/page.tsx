'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import icons to prevent hydration mismatch
const BeakerIcon = dynamic(() => import('@heroicons/react/24/outline').then(mod => mod.BeakerIcon), { ssr: false });
const BookOpenIcon = dynamic(() => import('@heroicons/react/24/outline').then(mod => mod.BookOpenIcon), { ssr: false });
const AcademicCapIcon = dynamic(() => import('@heroicons/react/24/outline').then(mod => mod.AcademicCapIcon), { ssr: false });
const RocketLaunchIcon = dynamic(() => import('@heroicons/react/24/outline').then(mod => mod.RocketLaunchIcon), { ssr: false });

import ArticleList from '../components/education/ArticleList';
import CategoryNav from '../components/education/CategoryNav';
import SearchBar from '../components/education/SearchBar';

const categories = [
  { 
    id: 'basics',
    name: 'DeFi Basics',
    icon: BookOpenIcon,
    description: 'Master the fundamentals of DeFi'
  },
  { 
    id: 'uniswap',
    name: 'Uniswap V4',
    icon: RocketLaunchIcon,
    description: 'Explore the next evolution of DeFi',
    active: true
  },
  { 
    id: 'strategies',
    name: 'Trading Strategies',
    icon: BeakerIcon,
    description: 'Advanced trading techniques'
  },
  { 
    id: 'advanced',
    name: 'Advanced Topics',
    icon: AcademicCapIcon,
    description: 'Deep dive into complex concepts'
  },
];

export default function EducationPage() {
  const [activeCategory, setActiveCategory] = useState('uniswap');
  const [searchQuery, setSearchQuery] = useState('');
  const [mounted, setMounted] = useState(false);

  // Handle client-side mounting
  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent flash of unstyled content
  if (!mounted) {
    return null;
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 dark:from-blue-950 dark:via-blue-900 dark:to-blue-950">
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-black/30"></div>
        <div className="relative max-w-7xl mx-auto py-32 px-4 sm:py-40 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-extrabold text-white sm:text-5xl md:text-6xl lg:text-7xl">
              Master DeFi with btb.finance
            </h1>
            <p className="mt-6 max-w-2xl mx-auto text-xl sm:text-2xl text-blue-100 font-medium">
              We believe knowledge is the key to success in DeFi. Here, we break it down for you.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-20 relative z-10">
        {/* Category Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {categories.map((category) => {
            const Icon = category.icon;
            return (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`p-8 rounded-xl shadow-xl transition-all duration-300 backdrop-blur-lg ${
                  activeCategory === category.id
                    ? 'bg-blue-600 text-white transform scale-105 ring-4 ring-blue-400'
                    : 'bg-white/90 dark:bg-gray-800/90 text-gray-900 dark:text-white hover:bg-blue-50 dark:hover:bg-gray-700 hover:scale-102'
                }`}
              >
                {Icon && (
                  <div className="flex justify-center">
                    <Icon
                      className={`h-12 w-12 mb-6 ${
                        activeCategory === category.id
                          ? 'text-white'
                          : 'text-blue-600 dark:text-blue-400'
                      }`}
                    />
                  </div>
                )}
                <h3 className="text-xl font-bold mb-3">{category.name}</h3>
                <p className={`text-base ${
                  activeCategory === category.id
                    ? 'text-blue-100'
                    : 'text-gray-600 dark:text-gray-300'
                }`}>
                  {category.description}
                </p>
              </button>
            );
          })}
        </div>

        {/* Search Bar */}
        <div className="mb-16">
          <SearchBar onSearch={setSearchQuery} />
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-16">
          {/* Article List */}
          <div className="lg:col-span-2">
            <ArticleList category={activeCategory} searchQuery={searchQuery} />
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Learning Path
              </h2>
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white font-bold">
                    1
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      DeFi Fundamentals
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Master the basics of decentralized finance
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
                    2
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      Uniswap V4
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Learn about the latest DeFi innovation
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center text-white font-bold">
                    3
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      Advanced Strategies
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Master complex trading techniques
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl shadow-lg p-6 text-white">
              <h2 className="text-xl font-semibold mb-4">
                Join Our Community
              </h2>
              <p className="mb-6 text-blue-100">
                Connect with fellow DeFi enthusiasts and share your knowledge
              </p>
              <button className="w-full bg-white text-blue-600 rounded-lg px-4 py-2 font-medium hover:bg-blue-50 transition-colors duration-200">
                Join Discord
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
