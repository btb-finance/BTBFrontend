'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/app/components/ui/card';
import { IconType } from 'react-icons';

interface FeatureCardProps {
  title: string;
  description: string;
  icon: IconType | any;
  color: string;
  index: number;
  highlight?: boolean;
}

export default function FeatureCard({ title, description, icon: Icon, color, index, highlight = false }: FeatureCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      layout
      whileHover={{ y: -8, scale: 1.02 }}
      className={highlight ? 'z-10' : ''}
    >
      <Card 
        className={`overflow-hidden border ${highlight ? 'border-btb-primary/30 shadow-lg shadow-btb-primary/10' : 'border-gray-200 dark:border-gray-800'} h-full transition-all duration-300 relative`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {highlight && (
          <motion.div 
            className="absolute -top-1 -right-1 bg-btb-primary text-white text-xs font-bold py-1 px-2 rounded-bl-md rounded-tr-md z-10"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
          >
            Featured
          </motion.div>
        )}
        
        <motion.div 
          className={`h-2 bg-gradient-to-r ${color}`}
          animate={{ 
            backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
          }}
          transition={{ 
            duration: 8, 
            repeat: Infinity,
            ease: "linear" 
          }}
          style={{ backgroundSize: '200% 200%' }}
        ></motion.div>
        
        <CardContent className={`p-6 relative ${highlight ? 'bg-gradient-to-b from-transparent to-btb-primary/5' : ''}`}>
          {/* Background pattern */}
          <motion.div 
            className="absolute top-0 right-0 w-24 h-24 opacity-5 pointer-events-none"
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          >
            <Icon className="w-full h-full" />
          </motion.div>
          
          <div className="flex items-center mb-4">
            <motion.div 
              className={`p-3 rounded-full ${color} bg-opacity-20 mr-4 ${highlight ? 'ring-2 ring-btb-primary/20 ring-offset-2 ring-offset-white dark:ring-offset-gray-900' : ''}`}
              animate={{ 
                scale: isHovered || highlight ? [1, 1.1, 1] : 1,
                boxShadow: isHovered || highlight
                  ? ['0 0 0 rgba(255,255,255,0)', '0 0 20px rgba(255,255,255,0.5)', '0 0 0 rgba(255,255,255,0)'] 
                  : '0 0 0 rgba(255,255,255,0)'
              }}
              transition={{ 
                scale: { duration: 1.5, repeat: isHovered || highlight ? Infinity : 0 },
                boxShadow: { duration: 1.5, repeat: isHovered || highlight ? Infinity : 0 }
              }}
            >
              <Icon className="w-6 h-6 text-white" />
            </motion.div>
            <div>
              <motion.h3 
                className={`text-lg font-semibold ${highlight ? 'bg-gradient-to-r from-btb-primary to-blue-600 bg-clip-text text-transparent' : ''}`}
                animate={{ color: isHovered && !highlight ? '#4f46e5' : highlight ? undefined : '#000000' }}
                transition={{ duration: 0.3 }}
              >
                {title}
              </motion.h3>
              
              {highlight && (
                <motion.div 
                  className="h-1 w-0 bg-gradient-to-r from-btb-primary to-blue-600 mt-1 rounded-full"
                  animate={{ width: isHovered ? '100%' : '30%' }}
                  transition={{ duration: 0.5 }}
                />
              )}
            </div>
          </div>
          
          <motion.p 
            className="text-gray-600 dark:text-gray-300"
            animate={{ opacity: isHovered ? 1 : 0.9 }}
            transition={{ duration: 0.3 }}
          >
            {description}
          </motion.p>
          
          <motion.div 
            className="w-full h-1 mt-4 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800"
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 0.8, delay: index * 0.2 }}
          >
            <motion.div 
              className={`h-full ${color}`}
              initial={{ width: '30%' }}
              animate={{ width: isHovered ? '100%' : highlight ? '60%' : '30%' }}
              transition={{ duration: 0.5 }}
            ></motion.div>
          </motion.div>
          
          {highlight && (
            <motion.div
              className="absolute -bottom-2 -right-2 w-20 h-20 opacity-10 pointer-events-none"
              animate={{ 
                rotate: [0, 180],
                scale: [1, 1.1, 1]
              }}
              transition={{ 
                rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                scale: { duration: 3, repeat: Infinity, ease: "easeInOut" }
              }}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full text-btb-primary">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
