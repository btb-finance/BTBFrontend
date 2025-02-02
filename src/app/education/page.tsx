'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import icons to prevent hydration mismatch
const BeakerIcon = dynamic(() => import('@heroicons/react/24/outline').then(mod => mod.BeakerIcon), { ssr: false });
const BookOpenIcon = dynamic(() => import('@heroicons/react/24/outline').then(mod => mod.BookOpenIcon), { ssr: false });
const AcademicCapIcon = dynamic(() => import('@heroicons/react/24/outline').then(mod => mod.AcademicCapIcon), { ssr: false });
const RocketLaunchIcon = dynamic(() => import('@heroicons/react/24/outline').then(mod => mod.RocketLaunchIcon), { ssr: false });

import ArticleList from '../components/education/ArticleList';
import SearchBar from '../components/education/SearchBar';

const categories = [
  { 
    id: 'basics',
    name: 'DeFi Basics',
    icon: BookOpenIcon,
    description: 'Master the fundamentals of DeFi'
  },
  {
    id: 'advanced',
    name: 'Advanced Topics',
    icon: AcademicCapIcon,
    description: 'Deep dive into complex DeFi concepts'
  },
  {
    id: 'strategies',
    name: 'Trading Strategies',
    icon: BeakerIcon,
    description: 'Learn effective trading techniques'
  },
  {
    id: 'new',
    name: 'Latest in DeFi',
    icon: RocketLaunchIcon,
    description: 'Stay updated with DeFi innovations'
  }
];

export default function EducationPage() {
  const [selectedCategory, setSelectedCategory] = useState('basics');
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            DeFi Education Hub
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Learn everything you need to know about DeFi and yield farming
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-8">
          <SearchBar onSearch={setSearchQuery} />
        </div>

        {/* Categories */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {categories.map((category) => {
            const Icon = category.icon;
            return (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`p-6 rounded-lg text-left transition-all ${
                  selectedCategory === category.id
                    ? 'bg-primary text-white'
                    : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <div className="flex items-center mb-4">
                  {Icon && <Icon className="h-6 w-6 mr-2" />}
                  <h3 className="text-lg font-semibold">{category.name}</h3>
                </div>
                <p className={`text-sm ${
                  selectedCategory === category.id
                    ? 'text-gray-100'
                    : 'text-gray-600 dark:text-gray-300'
                }`}>
                  {category.description}
                </p>
              </button>
            );
          })}
        </div>

        {/* Article List */}
        <ArticleList category={selectedCategory} searchQuery={searchQuery} />
      </div>
    </div>
  );
}
