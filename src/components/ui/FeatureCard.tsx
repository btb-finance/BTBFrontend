'use client';

import { motion } from 'framer-motion';
import { Icons, type IconName } from '@/components/ui/Icons';
import React from 'react';

interface FeatureCardProps {
  icon: keyof typeof Icons;
  title: string;
  description: string;
  className?: string;
}

export const FeatureCard = ({ title, description, icon, className = '' }: FeatureCardProps) => {
  const IconComponent = Icons[icon];
  
  if (!IconComponent) {
    console.error(`Icon not found: ${icon}`);
    return null;
  }

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className={`gradient-border p-6 bg-[var(--background-light)] group hover:shadow-lg transition-shadow duration-300 ${className}`}
    >
      <div className="w-12 h-12 rounded-full bg-[var(--primary)] bg-opacity-20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
        <div className="w-8 h-8 rounded-full bg-[var(--primary)] flex items-center justify-center">
          <IconComponent className="w-4 h-4 text-white" />
        </div>
      </div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-[var(--text-secondary)]">{description}</p>
    </motion.div>
  );
};
