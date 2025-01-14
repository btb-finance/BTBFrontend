'use client';

import { motion } from 'framer-motion';
import { Icons, type IconName } from '@/components/ui/Icons';
import React from 'react';

interface FeatureCardProps {
  title: string;
  description: string;
  icon: IconName;
}

export const FeatureCard = ({ title, description, icon }: FeatureCardProps) => {
  const IconComponent = Icons[icon];
  
  if (!IconComponent) {
    console.error(`Icon not found: ${icon}`);
    return null;
  }

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="gradient-border p-6 bg-[var(--background-light)] group hover:bg-[var(--background-dark)] transition-all duration-300"
    >
      <motion.div
        initial={{ scale: 1 }}
        whileHover={{ scale: 1.1, rotate: 5 }}
        className="text-3xl mb-6 group-hover:text-[var(--primary)] transition-colors"
      >
        <IconComponent className="w-8 h-8" />
      </motion.div>
      <h3 className="text-xl font-semibold mb-3 group-hover:text-[var(--primary)] transition-colors">
        {title}
      </h3>
      <p className="text-[var(--text-secondary)] leading-relaxed">
        {description}
      </p>
    </motion.div>
  );
};
