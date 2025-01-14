'use client';

import { useState } from 'react';

interface FaqItemProps {
  question: string;
  answer: string | React.ReactNode;
}

export const FaqItem = ({ question, answer }: FaqItemProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-white/10">
      <button
        className="w-full py-4 flex items-center justify-between text-left hover:text-blue-400 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <span className="text-lg font-medium">{question}</span>
        <span className={`text-2xl transition-transform duration-200 ${isOpen ? 'rotate-45' : ''}`}>
          +
        </span>
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ${
          isOpen ? 'max-h-96 pb-4' : 'max-h-0'
        }`}
      >
        <div className="text-gray-400 prose prose-invert max-w-none">
          {answer}
        </div>
      </div>
    </div>
  );
};
