'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface ChartData {
  name: string;
  value: number;
  color: string;
}

export default function DistributionChart() {
  const [mounted, setMounted] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [rotation, setRotation] = useState(0);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Add continuous rotation animation
    const rotationInterval = setInterval(() => {
      setRotation(prev => (prev + 0.1) % 360);
    }, 50);

    return () => clearInterval(rotationInterval);
  }, []);

  // BTB Protocol distribution data
  const data: ChartData[] = [
    { name: 'Active Borrowers', value: 45, color: '#2775CA' },
    { name: 'Available Liquidity', value: 35, color: '#10B981' },
    { name: 'Flash Loan Usage', value: 20, color: '#F59E0B' }
  ];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700"
        >
          <p className="font-medium">{payload[0].name}</p>
          <p className="text-btb-primary font-bold">{`${payload[0].value}%`}</p>
        </motion.div>
      );
    }
    return null;
  };

  const onPieEnter = (_: any, index: number) => {
    setActiveIndex(index);
    setHovered(true);
  };

  const onPieLeave = () => {
    setActiveIndex(null);
    setHovered(false);
  };

  if (!mounted) return null;

  return (
    <div className="w-full h-64 md:h-80 relative">
      {/* Animated background elements */}
      <motion.div 
        className="absolute w-full h-full flex items-center justify-center opacity-20 pointer-events-none"
        style={{ transform: `rotate(${rotation}deg)` }}
      >
        <div className="w-40 h-40 rounded-full border-4 border-btb-primary"></div>
        <div className="absolute w-60 h-60 rounded-full border-2 border-dashed border-btb-primary"></div>
        <div className="absolute w-80 h-80 rounded-full border border-btb-primary opacity-50"></div>
      </motion.div>

      {/* Radial gradient background */}
      <div className="absolute inset-0 bg-gradient-radial from-blue-500/5 to-transparent rounded-full pointer-events-none"></div>

      {/* Central text */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
        <motion.div 
          className="text-center"
          animate={{ 
            scale: hovered ? [1, 1.05, 1] : 1,
          }}
          transition={{ 
            duration: 2, 
            repeat: hovered ? Infinity : 0,
            repeatType: "reverse" 
          }}
        >
          <motion.div
            className="flex flex-col items-center justify-center"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <span className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">Protocol</span>
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Usage</span>
          </motion.div>
        </motion.div>
      </div>

      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
            onMouseEnter={onPieEnter}
            onMouseLeave={onPieLeave}
            animationDuration={1500}
          >
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.color} 
                stroke={activeIndex === index ? '#fff' : 'none'}
                strokeWidth={activeIndex === index ? 2 : 0}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend with animation */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-center">
        <motion.div 
          className="flex flex-wrap items-center gap-3 bg-white/80 dark:bg-gray-900/80 px-4 py-2 rounded-full shadow-sm backdrop-blur-sm"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          {data.map((item, index) => (
            <div key={item.name} className="flex items-center">
              <motion.div 
                className="w-3 h-3 rounded-full mr-1"
                style={{ backgroundColor: item.color }}
                animate={{ 
                  boxShadow: [
                    '0 0 0 rgba(0, 0, 0, 0.4)',
                    `0 0 0 4px ${item.color}20`,
                    '0 0 0 rgba(0, 0, 0, 0.4)'
                  ]
                }}
                transition={{ 
                  duration: 2, 
                  repeat: Infinity,
                  repeatType: "loop",
                  delay: index * 0.3
                }}
              />
              <span className="text-xs font-medium">{item.name}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
