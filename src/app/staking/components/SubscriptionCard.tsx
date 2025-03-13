import { useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { LockClosedIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import { Card, CardContent } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import ServiceIcon from './ServiceIcon';

interface SubscriptionService {
  name: string;
  description: string;
  requiredStake: number;
  logo: string;
  category: string;
  color: string;
}

interface SubscriptionCardProps {
  service: SubscriptionService;
  index: number;
}

export default function SubscriptionCard({ service, index }: SubscriptionCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      layout
    >
      <Card 
        className="overflow-hidden border border-gray-200 dark:border-gray-800 h-full"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className={`h-2 bg-gradient-to-r ${service.color}`}></div>
        <CardContent className="p-6">
          <div className="flex items-center mb-4">
            <div className="relative w-12 h-12 mr-4 rounded-full overflow-hidden flex items-center justify-center">
              {!imageError && service.logo ? (
                <Image 
                  src={service.logo} 
                  alt={service.name} 
                  width={40} 
                  height={40} 
                  className="object-contain"
                  onError={() => setImageError(true)}
                />
              ) : (
                <ServiceIcon name={service.name} color={service.color} />
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{service.name}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{service.category.charAt(0).toUpperCase() + service.category.slice(1)}</p>
            </div>
          </div>
          
          <p className="text-gray-600 dark:text-gray-300 mb-6 h-12 line-clamp-2">{service.description}</p>
          
          <div className="flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Required Stake</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {service.requiredStake.toLocaleString()} BTB
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Lock Period</span>
              <span className="font-semibold text-gray-900 dark:text-white">1 Year</span>
            </div>
            
            <Button 
              className="w-full mt-2"
              variant="outline"
              leftIcon={<LockClosedIcon className="w-4 h-4" />}
              rightIcon={<ArrowRightIcon className="w-4 h-4" />}
              onClick={() => {
                const stakingForm = document.getElementById('staking-form');
                stakingForm?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              Stake for {service.name}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
