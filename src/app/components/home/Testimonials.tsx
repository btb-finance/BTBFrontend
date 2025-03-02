'use client';

import { useRef } from 'react';
import { UserGroupIcon, ChatBubbleLeftRightIcon, GlobeAltIcon } from '@heroicons/react/24/outline';
import { motion, useInView } from 'framer-motion';
import { Button } from '@/app/components/ui/button';
import Link from 'next/link';

interface CommunityFeatureProps {
  icon: React.ElementType;
  title: string;
  description: string;
}

const CommunityFeature = ({ icon: Icon, title, description }: CommunityFeatureProps) => {
  return (
    <motion.div 
      className="flex flex-col items-center p-6 bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-100 dark:border-gray-700"
      whileHover={{ y: -5, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.15)" }}
      transition={{ duration: 0.3 }}
    >
      <div className="p-3 bg-btb-primary/10 rounded-full mb-4">
        <Icon className="w-8 h-8 text-btb-primary" />
      </div>
      <h3 className="text-xl font-semibold mb-2 text-center">{title}</h3>
      <p className="text-gray-600 dark:text-gray-300 text-center">{description}</p>
    </motion.div>
  );
};

export default function Testimonials() {
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { once: false, amount: 0.3 });

  const communityFeatures = [
    {
      icon: UserGroupIcon,
      title: "Join Our Community",
      description: "Connect with thousands of BTB Finance users worldwide to share strategies and insights."
    },
    {
      icon: ChatBubbleLeftRightIcon,
      title: "Get Support",
      description: "Access our dedicated support channels for personalized assistance with your DeFi journey."
    },
    {
      icon: GlobeAltIcon,
      title: "Stay Updated",
      description: "Receive the latest news, updates, and educational content from our growing ecosystem."
    }
  ];

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 py-20"
    >
      {/* Background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-btb-primary/5 rounded-full filter blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-btb-primary/5 rounded-full filter blur-3xl"></div>
      </div>

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div 
          className="mx-auto max-w-2xl text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <h2 className="text-3xl font-bold tracking-tight text-btb-primary dark:text-btb-primary sm:text-4xl font-heading">
              Join Our Community
            </h2>
            <p className="mt-4 text-lg leading-8 text-gray-600 dark:text-gray-300">
              Be part of the BTB Finance ecosystem and help shape the future of DeFi
            </p>
          </motion.div>
        </motion.div>

        <motion.div 
          className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12"
          variants={{
            hidden: { opacity: 0 },
            show: {
              opacity: 1,
              transition: {
                staggerChildren: 0.1
              }
            }
          }}
          initial="hidden"
          animate={isInView ? "show" : "hidden"}
        >
          {communityFeatures.map((feature, index) => (
            <motion.div
              key={index}
              variants={{
                hidden: { opacity: 0, y: 20 },
                show: { opacity: 1, y: 0 }
              }}
            >
              <CommunityFeature 
                icon={feature.icon} 
                title={feature.title} 
                description={feature.description} 
              />
            </motion.div>
          ))}
        </motion.div>

        <motion.div 
          className="text-center"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Link href="/community" passHref>
            <Button size="lg" className="bg-btb-primary hover:bg-btb-primary/90 text-white">
              Explore Our Community
            </Button>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
