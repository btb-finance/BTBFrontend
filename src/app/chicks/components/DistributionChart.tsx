'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface ChartData {
  name: string;
  value: number;
  color: string;
  [key: string]: any; // Required for Recharts v3
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

  // CHICKS is 100% backed by USDC
  const data: ChartData[] = [
    { name: 'USDC Backing', value: 100, color: '#2775CA' }
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
            <span className="text-4xl font-bold bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">100%</span>
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">USDC Backed</span>
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
            paddingAngle={0}
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
          className="flex items-center bg-white/80 dark:bg-gray-900/80 px-4 py-2 rounded-full shadow-sm backdrop-blur-sm"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <motion.div 
            className="w-3 h-3 rounded-full mr-2"
            style={{ backgroundColor: data[0].color }}
            animate={{ 
              boxShadow: [
                '0 0 0 rgba(39, 117, 202, 0.4)',
                '0 0 0 4px rgba(39, 117, 202, 0.1)',
                '0 0 0 rgba(39, 117, 202, 0.4)'
              ]
            }}
            transition={{ 
              duration: 2, 
              repeat: Infinity,
              repeatType: "loop" 
            }}
          />
          <span className="text-xs font-medium">USDC Backing: 100%</span>
        </motion.div>
      </div>
    </div>
  );
}
