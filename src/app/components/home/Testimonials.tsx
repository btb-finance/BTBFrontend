'use client';

import { useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

const testimonials = [
  {
    content: "BTB Finance's innovative approach to DeFi has revolutionized how I manage my crypto portfolio. Their yield farming solutions are unmatched.",
    author: "David Chang",
    role: "Crypto Fund Manager"
  },
  {
    content: "The BTB Token ecosystem provides incredible opportunities for passive income. The community support is phenomenal.",
    author: "Elena Martinez",
    role: "BTB Token Holder"
  },
  {
    content: "As an early adopter of BTBT Tax Token, I've seen remarkable returns. The platform's security and transparency are outstanding.",
    author: "James Wilson",
    role: "DeFi Strategist"
  }
];

export default function Testimonials() {
  const [currentIndex, setCurrentIndex] = useState(0);

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

  return (
    <div className="bg-btb-primary bg-opacity-5 dark:bg-opacity-10 py-16">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-btb-primary dark:text-btb-primary sm:text-4xl">
            Community Success Stories
          </h2>
          <p className="mt-4 text-lg leading-8 text-gray-600 dark:text-gray-300">
            Discover how BTB Finance is transforming the DeFi landscape
          </p>
        </div>
        <div className="relative mt-16">
          <div className="relative h-80 overflow-hidden">
            {testimonials.map((testimonial, idx) => (
              <div
                key={idx}
                className={`absolute w-full transition-all duration-500 ease-in-out ${
                  idx === currentIndex
                    ? 'opacity-100 translate-x-0'
                    : 'opacity-0 translate-x-full'
                }`}
              >
                <figure className="text-center">
                  <blockquote className="text-xl font-semibold leading-8 text-gray-900 dark:text-white sm:text-2xl sm:leading-9">
                    <p>&ldquo;{testimonial.content}&rdquo;</p>
                  </blockquote>
                  <figcaption className="mt-8">
                    <div className="mt-4">
                      <div className="font-semibold text-btb-primary">{testimonial.author}</div>
                      <div className="text-gray-600 dark:text-gray-400">{testimonial.role}</div>
                    </div>
                  </figcaption>
                </figure>
              </div>
            ))}
          </div>
          <button
            onClick={prev}
            className="absolute left-0 top-1/2 -translate-y-1/2 bg-white dark:bg-gray-800 p-2 rounded-full shadow-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <ChevronLeftIcon className="h-6 w-6 text-btb-primary" />
          </button>
          <button
            onClick={next}
            className="absolute right-0 top-1/2 -translate-y-1/2 bg-white dark:bg-gray-800 p-2 rounded-full shadow-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <ChevronRightIcon className="h-6 w-6 text-btb-primary" />
          </button>
        </div>
      </div>
    </div>
  );
}
