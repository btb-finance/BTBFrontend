'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface ComingSoonBannerProps {
  productName?: string;
}

const ComingSoonBanner: React.FC<ComingSoonBannerProps> = ({ productName = 'This feature' }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-black py-3 px-4 rounded-lg shadow-md mb-6"
    >
      <div className="flex items-center justify-center space-x-2">
        <ExclamationTriangleIcon className="h-6 w-6" />
        <p className="font-semibold text-center">
          {productName} is not live yet. Stay tuned for updates!
        </p>
      </div>
    </motion.div>
  );
};

export default ComingSoonBanner;
