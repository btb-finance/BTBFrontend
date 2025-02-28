'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import { motion, AnimatePresence, useInView } from 'framer-motion';

const testimonials = [
  {
    content: "BTB Finance's innovative approach to DeFi has revolutionized how I manage my crypto portfolio. Their yield farming solutions are unmatched.",
    author: "David Chang",
    role: "Crypto Fund Manager",
    avatar: "/images/btblogo.jpg",
    rating: 5
  },
  {
    content: "The BTB Token ecosystem provides incredible opportunities for passive income. The community support is phenomenal.",
    author: "Elena Martinez",
    role: "BTB Token Holder",
    avatar: "/images/btblogo.jpg",
    rating: 5
  },
  {
    content: "As an early adopter of BTBT Tax Token, I've seen remarkable returns. The platform's security and transparency are outstanding.",
    author: "James Wilson",
    role: "DeFi Strategist",
    avatar: "/images/btblogo.jpg",
    rating: 5
  }
];

export default function Testimonials() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { once: false, amount: 0.3 });
  const [autoplay, setAutoplay] = useState(true);

  // Autoplay functionality
  useEffect(() => {
    if (!autoplay) return;
    
    const interval = setInterval(() => {
      next();
    }, 5000);
    
    return () => clearInterval(interval);
  }, [currentIndex, autoplay]);

  const next = () => {
    setCurrentIndex((prevIndex) => 
      prevIndex === testimonials.length - 1 ? 0 : prevIndex + 1
    );
  };

  const prev = () => {
    setCurrentIndex((prevIndex) => 
      prevIndex === 0 ? testimonials.length - 1 : prevIndex - 1
    );
  };

  // Generate star rating
  const StarRating = ({ rating }: { rating: number }) => {
    return (
      <div className="flex items-center justify-center space-x-1 mt-2">
        {[...Array(5)].map((_, i) => (
          <svg 
            key={i} 
            className={`w-5 h-5 ${i < rating ? 'text-yellow-400' : 'text-gray-300'}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
    );
  };

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
          className="mx-auto max-w-2xl text-center"
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
              Community Success Stories
            </h2>
            <p className="mt-4 text-lg leading-8 text-gray-600 dark:text-gray-300">
              Discover how BTB Finance is transforming the DeFi landscape
            </p>
          </motion.div>
        </motion.div>

        <div className="relative mt-16 h-[400px] md:h-[350px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
              className="absolute inset-0"
            >
              <div className="flex items-center justify-center h-full">
                <motion.div 
                  className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 md:p-10 max-w-2xl mx-auto border border-gray-100 dark:border-gray-700"
                  whileHover={{ y: -5, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex flex-col items-center">
                    <div className="relative mb-6">
                      <div className="absolute -top-1 -left-1 w-16 h-16 bg-btb-primary/20 rounded-full blur-md"></div>
                      <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-btb-primary">
                        {testimonials[currentIndex].avatar ? (
                          <img 
                            src={testimonials[currentIndex].avatar} 
                            alt={testimonials[currentIndex].author} 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-btb-primary/10">
                            <UserCircleIcon className="w-12 h-12 text-btb-primary" />
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <StarRating rating={testimonials[currentIndex].rating} />
                    
                    <blockquote className="mt-6 text-xl font-medium leading-8 text-gray-900 dark:text-white text-center">
                      <svg className="w-8 h-8 text-btb-primary/30 mb-4 mx-auto" fill="currentColor" viewBox="0 0 32 32">
                        <path d="M9.352 4C4.456 7.456 1 13.12 1 19.36c0 5.088 3.072 8.064 6.624 8.064 3.36 0 5.856-2.688 5.856-5.856 0-3.168-2.208-5.472-5.088-5.472-.576 0-1.344.096-1.536.192.48-3.264 3.552-7.104 6.624-9.024L9.352 4zm16.512 0c-4.8 3.456-8.256 9.12-8.256 15.36 0 5.088 3.072 8.064 6.624 8.064 3.264 0 5.856-2.688 5.856-5.856 0-3.168-2.304-5.472-5.184-5.472-.576 0-1.248.096-1.44.192.48-3.264 3.456-7.104 6.528-9.024L25.864 4z" />
                      </svg>
                      <p>"{testimonials[currentIndex].content}"</p>
                    </blockquote>
                    
                    <div className="mt-8 text-center">
                      <div className="font-semibold text-btb-primary text-lg">{testimonials[currentIndex].author}</div>
                      <div className="text-gray-600 dark:text-gray-400">{testimonials[currentIndex].role}</div>
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Navigation dots */}
          <div className="absolute bottom-0 left-0 right-0 flex justify-center space-x-2 mt-8">
            {testimonials.map((_, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setCurrentIndex(idx);
                  setAutoplay(false);
                }}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${idx === currentIndex ? 'bg-btb-primary scale-125' : 'bg-gray-300 dark:bg-gray-600'}`}
                aria-label={`Go to testimonial ${idx + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
