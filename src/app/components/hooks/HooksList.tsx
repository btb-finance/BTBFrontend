'use client';

import React from 'react';
import { Hook } from '../../types/hooks';
import { mockHooks } from '../../data/hooksData';
import { FaGlobe, FaTwitter, FaDiscord, FaTelegram, FaGithub } from 'react-icons/fa';
import { IconType } from 'react-icons';

const SocialLink = ({ href, icon: Icon, label }: { href?: string; icon: IconType; label: string }) => {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-gray-400 hover:text-[#FF0420] transition-colors"
      aria-label={label}
    >
      <Icon className="w-5 h-5" />
    </a>
  );
};

const HookCard = ({ hook }: { hook: Hook }) => (
  <div className="card hover:shadow-lg transition-all duration-300">
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-xl font-semibold flex items-center gap-2">
        {hook.name}
        {hook.verified && (
          <svg className="w-5 h-5 text-[#FF0420]" fill="currentColor" viewBox="0 0 20 20">
            <path d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
          </svg>
        )}
      </h3>
      <span className="text-sm text-[#FF0420]">{hook.protocol}</span>
    </div>
    <p className="text-gray-600 dark:text-gray-300 mb-4">{hook.description}</p>
    
    <div className="grid grid-cols-3 gap-4 mb-4">
      <div>
        <div className="text-sm text-gray-500 dark:text-gray-400">TVL</div>
        <div className="font-semibold">{hook.tvl}</div>
      </div>
      <div>
        <div className="text-sm text-gray-500 dark:text-gray-400">24h Volume</div>
        <div className="font-semibold">{hook.volume24h}</div>
      </div>
      <div>
        <div className="text-sm text-gray-500 dark:text-gray-400">APY</div>
        <div className="font-semibold text-green-600 dark:text-green-400">{hook.apy}</div>
      </div>
    </div>

    <div className="mb-4">
      <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">Deployed On</div>
      <div className="flex flex-wrap gap-2">
        {hook.deployedOn.map((chain) => (
          <span key={chain} className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-xs">
            {chain}
          </span>
        ))}
      </div>
    </div>

    <div className="flex justify-between items-center">
      <div className="flex gap-4">
        <SocialLink href={hook.socialLinks.website} icon={FaGlobe} label="Website" />
        <SocialLink href={hook.socialLinks.twitter} icon={FaTwitter} label="Twitter" />
        <SocialLink href={hook.socialLinks.discord} icon={FaDiscord} label="Discord" />
        <SocialLink href={hook.socialLinks.telegram} icon={FaTelegram} label="Telegram" />
        <SocialLink href={hook.socialLinks.github} icon={FaGithub} label="GitHub" />
      </div>
      <div className="flex items-center gap-2">
        <span className={`px-2 py-1 rounded text-xs ${
          hook.riskLevel === 'Low' ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' :
          hook.riskLevel === 'Medium' ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300' :
          'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
        }`}>
          {hook.riskLevel} Risk
        </span>
        <span className={`px-2 py-1 rounded text-xs ${
          hook.auditStatus === 'Audited' ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' :
          hook.auditStatus === 'In Progress' ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300' :
          'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
        }`}>
          {hook.auditStatus}
        </span>
      </div>
    </div>
  </div>
);

export default function HooksList() {
  const [sortBy, setSortBy] = React.useState<'tvl' | 'volume' | 'apy'>('tvl');
  
  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSortBy(e.target.value as 'tvl' | 'volume' | 'apy');
  };

  const [sortedHooks, setSortedHooks] = React.useState(mockHooks);

  React.useEffect(() => {
    const sorted = [...mockHooks].sort((a, b) => {
      switch (sortBy) {
        case 'tvl':
          return parseFloat(b.tvl.replace(/[$,]/g, '')) - parseFloat(a.tvl.replace(/[$,]/g, ''));
        case 'volume':
          return parseFloat(b.volume24h.replace(/[$,]/g, '')) - parseFloat(a.volume24h.replace(/[$,]/g, ''));
        case 'apy':
          return parseFloat(b.apy) - parseFloat(a.apy);
        default:
          return 0;
      }
    });
    setSortedHooks(sorted);
  }, [sortBy]);

  return (
    <div className="max-w-7xl mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gradient">Popular Hooks</h2>
        <div className="flex gap-4">
          <select 
            className="px-4 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 focus:border-[#FF0420] focus:ring-1 focus:ring-[#FF0420]"
            value={sortBy}
            onChange={handleSortChange}
          >
            <option value="tvl">Sort by TVL</option>
            <option value="volume">Sort by Volume</option>
            <option value="apy">Sort by APY</option>
          </select>
          <select 
            className="px-4 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 focus:border-[#FF0420] focus:ring-1 focus:ring-[#FF0420]"
          >
            <option value="">Risk Level</option>
            <option value="low">Low Risk</option>
            <option value="medium">Medium Risk</option>
            <option value="high">High Risk</option>
          </select>
          <select 
            className="px-4 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 focus:border-[#FF0420] focus:ring-1 focus:ring-[#FF0420]"
          >
            <option value="">Audit Status</option>
            <option value="audited">Audited</option>
            <option value="in-progress">In Progress</option>
            <option value="not-audited">Not Audited</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {sortedHooks.map((hook) => (
          <HookCard key={hook.id} hook={hook} />
        ))}
      </div>
    </div>
  );
}
