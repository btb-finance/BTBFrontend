'use client';

import React, { useState, useEffect } from 'react';

interface TypewriterEffectProps {
  words: string[];
  delayBetweenWords?: number;
  typingSpeed?: number;
  deletingSpeed?: number;
  className?: string;
}

export default function TypewriterEffect({
  words = [],
  delayBetweenWords = 1500,
  typingSpeed = 100,
  deletingSpeed = 50,
  className = '',
}: TypewriterEffectProps) {
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [currentText, setCurrentText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [cursorVisible, setCursorVisible] = useState(true);

  // Blink cursor effect
  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setCursorVisible((prev) => !prev);
    }, 500);
    
    return () => clearInterval(cursorInterval);
  }, []);

  // Typing and deleting effect
  useEffect(() => {
    if (words.length === 0) return;

    const currentWord = words[currentWordIndex];
    
    const timeout = setTimeout(() => {
      if (!isDeleting) {
        // Adding characters
        if (currentText.length < currentWord.length) {
          setCurrentText(currentWord.substring(0, currentText.length + 1));
        } else {
          // Start deleting after delay
          setTimeout(() => {
            setIsDeleting(true);
          }, delayBetweenWords);
        }
      } else {
        // Removing characters
        if (currentText.length > 0) {
          setCurrentText(currentWord.substring(0, currentText.length - 1));
        } else {
          // Move to next word
          setIsDeleting(false);
          setCurrentWordIndex((prev) => (prev + 1) % words.length);
        }
      }
    }, isDeleting ? deletingSpeed : typingSpeed);
    
    return () => clearTimeout(timeout);
  }, [words, currentWordIndex, currentText, isDeleting, typingSpeed, deletingSpeed, delayBetweenWords]);

  return (
    <div className={`flex items-center ${className}`}>
      <span className={className ? className : "bg-gradient-to-r from-btb-primary-dark to-btb-primary px-3 py-1 rounded text-white font-medium inline-block"}>
        {currentText}
        <span 
          className={`inline-block w-1 h-5 ml-0.5 ${className ? 'bg-btb-primary-light dark:bg-btb-primary' : 'bg-white'} ${cursorVisible ? 'opacity-100' : 'opacity-0'}`}
          style={{ transition: 'opacity 0.1s' }}
        ></span>
      </span>
    </div>
  );
}
